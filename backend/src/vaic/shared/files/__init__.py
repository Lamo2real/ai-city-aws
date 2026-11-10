"""Files: the owner's one storage area for media and assets (docs/FILES.md, decision 147).

A separate store from the knowledge base: files are kept, shown and downloaded as files; the knowledge base is
what agents read as reference. Every file gets a searchable description (an image caption, a document's text,
a video's frames and transcript) embedded with Titan Text Embeddings V2, so VAIC finds a file from a vague
description and a time ("the sunrise thumbnail with the Porsche from last spring").
"""
