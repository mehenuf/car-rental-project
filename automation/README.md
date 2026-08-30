# Automation

This folder holds the exported n8n workflow referenced from the main [README.md](../README.md#9-the-automation).

To add it:

1. Open the workflow in n8n.
2. Use the menu in the top right and choose **Download**. This saves the workflow as a JSON file.
3. Save that file here as `n8n-workflow.json`.

Nothing in this file contains secrets by default, but double-check before committing: if any node has credentials pasted directly into a parameter instead of referenced through n8n's credential store, remove them before this file goes into the repository.
