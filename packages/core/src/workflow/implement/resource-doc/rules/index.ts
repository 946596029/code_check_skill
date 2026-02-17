import type { Rule } from "../../../types/rule/rule";
import { FrontmatterExistsRule } from "./frontmatter-exists-rule";

export { FrontmatterExistsRule } from "./frontmatter-exists-rule";

/**
 * Default rules for ResourceDocWorkflow (Terraform resource doc validation).
 */
export const RESOURCE_DOC_RULES: Rule[] = [new FrontmatterExistsRule()];
