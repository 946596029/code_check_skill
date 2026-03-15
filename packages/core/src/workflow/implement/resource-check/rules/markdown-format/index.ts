import type { Rule } from "../../../../types/rule/rule";
import { FrontmatterCheckRule } from "./frontmatter-check-rule";
import { LineLengthRule } from "./line-length-rule";
import { NumberFormatRule } from "./number-format-rule";
import { H1ExistsRule } from "./h1-exists-rule";
import { ExampleSectionExistsRule } from "./example-section-exists-rule";
import { BlankLineBetweenBlocksRule } from "./blank-line-between-blocks-rule";

export { FrontmatterCheckRule } from "./frontmatter-check-rule";
export { LineLengthRule } from "./line-length-rule";
export { NumberFormatRule } from "./number-format-rule";
export { H1ExistsRule } from "./h1-exists-rule";
export { ExampleSectionExistsRule } from "./example-section-exists-rule";
export { BlankLineBetweenBlocksRule } from "./blank-line-between-blocks-rule";

export const MARKDOWN_FORMAT_RULES: Rule[] = [
    new FrontmatterCheckRule(),
    new LineLengthRule(),
    new NumberFormatRule(),
    new BlankLineBetweenBlocksRule(),
    new H1ExistsRule(),
    new ExampleSectionExistsRule(),
];
