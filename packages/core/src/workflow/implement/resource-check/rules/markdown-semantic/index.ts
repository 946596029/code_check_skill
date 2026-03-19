import type { Rule } from "../../../../types/rule/rule";
import { SectionExistenceRule } from "./total/section-existence-rule";
import { ArgumentSectionSemanticRule } from "./arguments/argument-section-semantic-rule";
import { AttributeSectionSemanticRule } from "./attributes/attribute-section-semantic-rule";

export {
    SectionExistenceRule,
    ArgumentSectionSemanticRule,
    AttributeSectionSemanticRule,
};

export const MARKDOWN_SEMANTIC_RULES: Rule[] = [
    new SectionExistenceRule(),
    new ArgumentSectionSemanticRule(),
    new AttributeSectionSemanticRule(),
];
