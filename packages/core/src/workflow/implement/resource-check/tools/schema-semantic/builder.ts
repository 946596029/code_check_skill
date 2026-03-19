import type { ResourceSchema, SchemaField } from "../terraform-schema";
import type {
    ImportView,
    SchemaSemanticView,
    SemanticField,
    TimeoutView,
} from "./types";

export function buildSchemaSemanticView(schema: ResourceSchema): SchemaSemanticView {
    const forceNewSet = new Set(schema.resourceSemantics?.forceNew?.fields ?? []);
    const nonUpdatableSet = new Set(schema.resourceSemantics?.nonUpdatable?.fields ?? []);

    const args = new Map<string, SemanticField>();
    const attrs = new Map<string, SemanticField>();

    for (const field of schema.fields) {
        classifyField(field, forceNewSet, nonUpdatableSet, args, attrs);
    }

    injectImplicitAttributes(attrs);

    return {
        resourceName: schema.resourceName,
        arguments: args,
        attributes: attrs,
        timeouts: buildTimeoutView(schema),
        importInfo: buildImportView(schema),
    };
}

function classifyField(
    field: SchemaField,
    forceNewSet: Set<string>,
    nonUpdatableSet: Set<string>,
    args: Map<string, SemanticField>,
    attrs: Map<string, SemanticField>,
): void {
    if (field.internal) return;

    const semantic = toSemanticField(field, forceNewSet, nonUpdatableSet);
    if (field.required || field.optional) {
        args.set(field.name, semantic);
    } else {
        attrs.set(field.name, semantic);
    }
}

function toSemanticField(
    field: SchemaField,
    forceNewSet: Set<string>,
    nonUpdatableSet: Set<string>,
): SemanticField {
    const result: SemanticField = {
        name: field.name,
        type: field.type,
        required: field.required,
        optional: field.optional,
        computed: field.computed,
        forceNew: field.forceNew || forceNewSet.has(field.name),
        nonUpdatable: nonUpdatableSet.has(field.name),
        description: field.description,
    };

    if (field.subFields && field.subFields.length > 0) {
        result.subFields = field.subFields.map(
            (sub) => toSemanticField(sub, forceNewSet, nonUpdatableSet),
        );
    }

    return result;
}

const IMPLICIT_ATTRIBUTES: SemanticField[] = [
    {
        name: "id",
        type: "TypeString",
        required: false,
        optional: false,
        computed: true,
        forceNew: false,
        nonUpdatable: false,
        description: "The resource ID.",
    },
];

function injectImplicitAttributes(attrs: Map<string, SemanticField>): void {
    for (const field of IMPLICIT_ATTRIBUTES) {
        if (!attrs.has(field.name)) {
            attrs.set(field.name, field);
        }
    }
}

function buildTimeoutView(schema: ResourceSchema): TimeoutView | null {
    const timeouts = schema.resourceSemantics?.timeouts;
    if (!timeouts) return null;

    const view: TimeoutView = {};
    let hasAny = false;

    if (timeouts.create?.confidence === "high" && timeouts.create.milliseconds != null) {
        view.create = timeouts.create.milliseconds;
        hasAny = true;
    }
    if (timeouts.read?.confidence === "high" && timeouts.read.milliseconds != null) {
        view.read = timeouts.read.milliseconds;
        hasAny = true;
    }
    if (timeouts.update?.confidence === "high" && timeouts.update.milliseconds != null) {
        view.update = timeouts.update.milliseconds;
        hasAny = true;
    }
    if (timeouts.delete?.confidence === "high" && timeouts.delete.milliseconds != null) {
        view.delete = timeouts.delete.milliseconds;
        hasAny = true;
    }

    return hasAny ? view : null;
}

function buildImportView(schema: ResourceSchema): ImportView {
    const semantics = schema.resourceSemantics;
    const options = schema.resourceOptions;

    const importable = semantics?.importable?.value ?? options?.hasImporter ?? false;
    const stateFunc = options?.importerStateContext;

    const idParts = semantics?.importIdParts?.confidence === "high"
        ? semantics.importIdParts.parts
        : undefined;

    return { importable, stateFunc, idParts };
}
