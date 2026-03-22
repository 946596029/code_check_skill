import type { Rule } from "../../../../types/rule/rule";
import { FrontmatterCheckRule } from "./frontmatter/frontmatter-check-rule";
import { LineLengthRule } from "./total/line-length-rule";
import { NumberFormatRule } from "./total/number-format-rule";
import { H1ExistsRule } from "./title/h1-exists-rule";
import { ExampleSectionExistsRule } from "./example/example-section-exists-rule";
import { BlankLineBetweenBlocksRule } from "./total/blank-line-between-blocks-rule";
import { ArgumentSectionFormatRule } from "./arguments/argument-section-format-rule";
import { ArgumentBlankLineBetweenItemsRule } from "./arguments/argument-blank-line-between-items-rule";
import { AttributeSectionFormatRule } from "./attributes/attribute-section-format-rule";
import { AttributeBlankLineBetweenItemsRule } from "./attributes/attribute-blank-line-between-items-rule";
import { TimeoutSectionFormatRule } from "./timeout/timeout-section-format-rule";

export { FrontmatterCheckRule } from "./frontmatter/frontmatter-check-rule";
export { LineLengthRule } from "./total/line-length-rule";
export { NumberFormatRule } from "./total/number-format-rule";
export { H1ExistsRule } from "./title/h1-exists-rule";
export { ExampleSectionExistsRule } from "./example/example-section-exists-rule";
export { BlankLineBetweenBlocksRule } from "./total/blank-line-between-blocks-rule";
export { ArgumentSectionFormatRule } from "./arguments/argument-section-format-rule";
export { ArgumentBlankLineBetweenItemsRule } from "./arguments/argument-blank-line-between-items-rule";
export { AttributeSectionFormatRule } from "./attributes/attribute-section-format-rule";
export { AttributeBlankLineBetweenItemsRule } from "./attributes/attribute-blank-line-between-items-rule";
export { TimeoutSectionFormatRule } from "./timeout/timeout-section-format-rule";

export const MARKDOWN_FORMAT_RULES: Rule[] = [
    new FrontmatterCheckRule(),
    new LineLengthRule(),
    new NumberFormatRule(),
    new BlankLineBetweenBlocksRule(),
    new H1ExistsRule(),
    new ExampleSectionExistsRule(),
    new ArgumentSectionFormatRule(),
    new ArgumentBlankLineBetweenItemsRule(),
    new AttributeSectionFormatRule(),
    new AttributeBlankLineBetweenItemsRule(),
    new TimeoutSectionFormatRule(),
];
