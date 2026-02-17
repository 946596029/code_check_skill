import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { ResourceDocWorkflow } from "@code-check/core";

describe("ResourceDocWorkflow - frontmatter-exists rule", () => {
    const samplePath = path.join(__dirname, "apig_channel_member.md");
    const sampleWithFrontmatter = fs.readFileSync(samplePath, "utf-8");

    it("should pass when document has front matter", async () => {
        const workflow = new ResourceDocWorkflow();
        workflow.setCode(sampleWithFrontmatter);
        workflow.preprocess();
        const results = await workflow.process();
        const frontmatterResults = results.filter((r) => r.message?.includes("front matter"));
        expect(frontmatterResults).toHaveLength(0);
    });

    it("should fail when document has no front matter", async () => {
        const docWithoutFrontmatter = `# huaweicloud_apig_channel_member

Some content without front matter.
`;
        const workflow = new ResourceDocWorkflow();
        workflow.setCode(docWithoutFrontmatter);
        workflow.preprocess();
        const results = await workflow.process();
        const frontmatterFail = results.find((r) => r.message === "Missing front matter block");
        expect(frontmatterFail).toBeDefined();
        expect(frontmatterFail?.success).toBe(false);
    });
});
