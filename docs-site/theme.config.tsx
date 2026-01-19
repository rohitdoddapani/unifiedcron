import React from "react";
import { DocsThemeConfig } from "nextra-theme-docs";

const config: DocsThemeConfig = {
  logo: <span>UnifiedCron Docs</span>,
  project: {
    link: "https://github.com/rohitdoddapani/unifiedcron"
  },
  docsRepositoryBase: "https://github.com/rohitdoddapani/unifiedcron/tree/main/docs-site",
  footer: {
    text: "UnifiedCron"
  },
  useNextSeoProps() {
    return {
      titleTemplate: "%s – UnifiedCron Docs"
    };
  }
};

export default config;
