"""Copies content.json into content.js so the page also works when index.html is
opened by double click (browsers block fetch on file:// pages).
Run after every edit of content.json:  python sync_content.py"""
import json, os

here = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(here, 'content.json'), encoding='utf-8') as f:
    data = json.load(f)
with open(os.path.join(here, 'content.js'), 'w', encoding='utf-8') as f:
    f.write('/* Generated from content.json by sync_content.py. Do not edit. */\n')
    f.write('window.CONTENT = ' + json.dumps(data, indent=2, ensure_ascii=False) + ';\n')
print('content.js updated')
