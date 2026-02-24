import type { Rule } from "../../../types/rule/rule";
import { FrontmatterExistsRule } from "./frontmatter-exists-rule";
import {
    H1StructureRule,
} from "./h1-structure";
import { ExampleUsageStructureRule } from "./example-usage-structure-rule";
import {
    ArgumentReferenceStructureRule,
} from "./argument-reference-structure";
import {
    AttributesReferenceStructureRule,
} from "./attributes-reference-structure";

export {
    FrontmatterExistsRule,
    H1StructureRule,
    ExampleUsageStructureRule,
    ArgumentReferenceStructureRule,
    AttributesReferenceStructureRule,
};

/**
 * Default rules for ResourceDocWorkflow (Terraform resource doc validation).
 */
export const RESOURCE_DOC_RULES: Rule[] = [
    new FrontmatterExistsRule(),
    new H1StructureRule(),
    new ExampleUsageStructureRule(),
    new ArgumentReferenceStructureRule(),
    new AttributesReferenceStructureRule(),
];
