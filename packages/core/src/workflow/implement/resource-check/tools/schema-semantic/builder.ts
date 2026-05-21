import type { ResourceSchema, SchemaField } from "../terraform-schema";
import type {
    ImportView,
    SchemaSemanticView,
    SemanticField,
    TimeoutView,
} from "./types";

export function buildSchemaSemanticView(
    schema: ResourceSchema,
    resourceType: "resource" | "data-source" = "resource"
): SchemaSemanticView {
    const forceNewSet = new Set(schema.resourceSemantics?.forceNew?.fields ?? []);
    const nonUpdatableSet = new Set(schema.resourceSemantics?.nonUpdatable?.fields ?? []);

    const args = new Map<string, SemanticField>();
    const attrs = new Map<string, SemanticField>();

    for (const field of schema.fields) {
        classifyField(field, forceNewSet, nonUpdatableSet, args, attrs);
    }

    if (resourceType === "resource") {
        injectImplicitAttributes(attrs);
    }

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

    const argSemantic = toSemanticField(field, forceNewSet, nonUpdatableSet, field.name);
    const attrSemantic = toSemanticField(field, forceNewSet, nonUpdatableSet, field.name);

    if (field.subFields && field.subFields.length > 0) {
        const { argSubFields, attrSubFields } = separateSubFields(
            field.subFields,
            forceNewSet,
            nonUpdatableSet,
            field.name,
        );
        argSemantic.subFields = argSubFields;
        attrSemantic.subFields = attrSubFields;
    }

    if (field.required || field.optional) {
        args.set(field.name, argSemantic);
    }

    if (field.computed && !field.required && !field.optional) {
        attrs.set(field.name, attrSemantic);
    }

    const hasComputedSubFields = attrSemantic.subFields && attrSemantic.subFields.length > 0;
    if (hasComputedSubFields) {
        attrs.set(field.name, attrSemantic);
    }
}

function separateSubFields(
    subFields: SchemaField[],
    forceNewSet: Set<string>,
    nonUpdatableSet: Set<string>,
    parentPath: string = "",
): { argSubFields: SemanticField[]; attrSubFields: SemanticField[] } {
    const argSubFields: SemanticField[] = [];
    const attrSubFields: SemanticField[] = [];

    for (const sub of subFields) {
        if (sub.internal) continue;

        const fieldPath = parentPath ? `${parentPath}.${sub.name}` : sub.name;
        const subSemantic = toSemanticField(sub, forceNewSet, nonUpdatableSet, fieldPath);
        let attrSubSemantic: SemanticField | undefined;

        if (sub.subFields && sub.subFields.length > 0) {
            const nested = separateSubFields(
                sub.subFields,
                forceNewSet,
                nonUpdatableSet,
                fieldPath,
            );
            subSemantic.subFields = nested.argSubFields;

            if (nested.attrSubFields.length > 0) {
                attrSubSemantic = toSemanticField(sub, forceNewSet, nonUpdatableSet, fieldPath);
                attrSubSemantic.subFields = nested.attrSubFields;
            }
        }

        if (sub.required || sub.optional) {
            argSubFields.push(subSemantic);
        }

        if (sub.computed && !sub.required && !sub.optional) {
            attrSubFields.push(subSemantic);
        }

        if (attrSubSemantic) {
            attrSubFields.push(attrSubSemantic);
        }
    }

    return { argSubFields, attrSubFields };
}

function toSemanticField(
    field: SchemaField,
    forceNewSet: Set<string>,
    nonUpdatableSet: Set<string>,
    fieldPath: string = field.name,
): SemanticField {
    return {
        name: field.name,
        type: field.type,
        required: field.required,
        optional: field.optional,
        computed: field.computed,
        forceNew: field.forceNew || forceNewSet.has(fieldPath),
        nonUpdatable: nonUpdatableSet.has(fieldPath),
        description: field.description,
    };
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
