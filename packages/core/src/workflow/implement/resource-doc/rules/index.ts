import type { Rule } from "../../../types/rule/rule";
import { FrontmatterExistsRule } from "./frontmatter-exists-rule";
import {
    H1StructureRule,
    H1TitleMatchesResourceRule,
    H1DescriptionMatchesRule,
    SpecialNotesFormatRule,
} from "./h1-structure";
import { ExampleUsageStructureRule } from "./example-usage-structure-rule";
import {
    ArgumentReferenceStructureRule,
    ArgumentIntroMatchesRule,
    ArgumentBulletFormatRule,
    ArgumentDescriptionFormatRule,
} from "./argument-reference-structure";
import {
    AttributesReferenceStructureRule,
    AttributeIntroMatchesRule,
    AttributeBulletFormatRule,
} from "./attributes-reference-structure";

export {
    FrontmatterExistsRule,
    H1StructureRule,
    H1TitleMatchesResourceRule,
    H1DescriptionMatchesRule,
    SpecialNotesFormatRule,
    ExampleUsageStructureRule,
    ArgumentReferenceStructureRule,
    ArgumentIntroMatchesRule,
    ArgumentBulletFormatRule,
    ArgumentDescriptionFormatRule,
    AttributesReferenceStructureRule,
    AttributeIntroMatchesRule,
    AttributeBulletFormatRule,
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
