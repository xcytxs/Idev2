import type { WebContainer } from "@webcontainer/api";
import type { ToolConfig } from "~/types/tools";

export abstract class BaseTool {
    protected webcontainer: Promise<WebContainer>;
    constructor(webcontainerPromise: Promise<WebContainer>) {
        this.webcontainer = webcontainerPromise;
    }
    /** Function to execute the tool with given arguments */
    abstract execute(args: { [key: string]: string }):Promise<string>;
}