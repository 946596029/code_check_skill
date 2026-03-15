import type { Rule } from "../../../../types/rule/rule";
import { SectionExistenceRule } from "./section-existence-rule";
import { ArgumentSectionSemanticRule } from "./argument-section-semantic-rule";
import { AttributeSectionSemanticRule } from "./attribute-section-semantic-rule";

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
