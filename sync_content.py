"""Run after every edit of content.json:   python sync_content.py

1. Copies content.json into content.js, so index.html also works when opened by double click.
2. Writes the whole site as plain semantic HTML into index.html (between the STATIC markers),
   so recruiters' tools, ATS parsers, search engines and anyone without JavaScript read the real
   content. The page script hides this copy from the screen once the bricks have built.
3. Refreshes the structured data (schema.org Person) in index.html.
"""
import json, os, re
from html import escape as e

here = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(here, 'content.json'), encoding='utf-8') as f:
    c = json.load(f)

# ---- 1. content.js ----
with open(os.path.join(here, 'content.js'), 'w', encoding='utf-8') as f:
    f.write('/* Generated from content.json by sync_content.py. Do not edit. */\n')
    f.write('window.CONTENT = ' + json.dumps(c, indent=2, ensure_ascii=False) + ';\n')


# ---- 2. static HTML ----
def p(t, cls=None):
    return '<p%s>%s</p>' % ((' class="%s"' % cls) if cls else '', e(t))

def ul(items):
    return '<ul>' + ''.join('<li>%s</li>' % e(i) for i in items) + '</ul>'

def stats(items):
    return '<ul>' + ''.join('<li><strong>%s</strong> %s</li>' % (e(s['value']), e(s['label'])) for s in items) + '</ul>'

def case_html(cs):
    out = []
    if cs.get('context'):
        out.append(p(cs['context']))
    if cs.get('stats'):
        out.append(stats(cs['stats']))
    for t in cs.get('intro', []):
        out.append(p(t))
    for b in cs.get('blocks', []):
        k = b['type']
        if k == 'text':
            out.append('<h4>%s</h4>' % e(b['heading']))
            out += [p(t) for t in b['paragraphs']]
        elif k == 'steps':
            out.append('<h4>%s</h4>' % e(b['heading']))
            out.append('<ol>' + ''.join('<li><strong>%s.</strong> %s</li>' % (e(s['title']), e(s['text'])) for s in b['items']) + '</ol>')
        elif k == 'matrix':
            out.append('<h4>%s</h4>' % e(b['heading']))
            head = '<tr><th></th>' + ''.join('<th>%s</th>' % e(x) for x in b['cols']) + '</tr>'
            rows = ''.join('<tr><th>%s</th>%s</tr>' % (e(r['label']), ''.join('<td>%s</td>' % e(x) for x in r['cells'])) for r in b['rows'])
            out.append('<table>%s%s</table>' % (head, rows))
        elif k == 'list':
            out.append('<h4>%s</h4>' % e(b['heading']))
            if b.get('intro'):
                out.append(p(b['intro']))
            out.append('<ol>' + ''.join('<li>%s</li>' % e(x) for x in b['items']) + '</ol>')
        elif k == 'stats':
            out.append('<h4>%s</h4>' % e(b['heading']))
            out.append(stats(b['items']))
        elif k == 'quote':
            out.append('<blockquote>%s</blockquote>' % e(b['text']))
    for l in cs.get('links', []):
        out.append('<p><a href="%s">%s</a></p>' % (e(l['href']), e(l['label'])))
    return '\n'.join(out)


def build_static(c):
    out = []
    for s in c['sections']:
        sid, kind, title = s['id'], s['kind'], s['title']
        out.append('<section id="s-%s">' % sid)
        if kind == 'intro':
            d = c['intro']
            out.append('<h1>%s</h1>' % e(d['heading']))
            out.append(p(d['aka']))
            out.append('<img src="%s" alt="%s" width="373" height="373">' % (e(d['photo']['src']), e(d['photo']['alt'])))
            out.append('<h2>%s</h2>' % e(d['story'].get('label', 'My story')))
            out.append(p(d['story']['lead']))
            out.append('<dl>' + ''.join('<dt>%s</dt><dd>%s</dd>' % (e(i['label']), e(i['text'])) for i in d['story']['items']) + '</dl>')
            out.append('<h2>%s</h2>' % e(d['detailsTitle']))
            out.append('<dl>' + ''.join('<dt>%s</dt><dd>%s</dd>' % (e(i['label']), e(i['value'])) for i in d['details']) + '</dl>')
        elif kind == 'about':
            a = c['about']
            out.append('<h2>%s</h2>' % e(title))
            for q in a['problems']:
                out.append('<h3>%s</h3>' % e(q['title']))
                out.append(p(q['text']))
            out.append(stats([{'value': n['value'], 'label': n['caption']} for n in a['numbers']]))
        elif kind == 'projects':
            out.append('<h2>%s</h2>' % e(title))
            for it in c['projects']['items']:
                out.append('<article>')
                out.append('<h3>%s</h3>' % e(it['title']))
                if it.get('subtitle'):
                    out.append(p(it['subtitle']))
                if it.get('status'):
                    out.append(p('Status: ' + it['status']))
                if it.get('empty'):
                    out.append(p('Work in progress.'))
                if it.get('summary'):
                    out.append(p(it['summary']))
                if it.get('tags'):
                    out.append(p('Focus: ' + ', '.join(it['tags'])))
                if it.get('parts'):
                    out.append(p('Parts: ' + ', '.join(it['parts'])))
                if it.get('case'):
                    out.append(case_html(it['case']))
                elif it.get('stats'):
                    out.append(stats(it['stats']))
                out.append('</article>')
        elif kind == 'experience':
            out.append('<h2>%s</h2>' % e(title))
            for r in c['experience']['roles']:
                out.append('<article><h3>%s</h3>' % e(r['title']))
                out.append(p('%s, %s' % (r['org'], r['dates'])))
                out.append(ul(r['bullets']))
                out.append('</article>')
        elif kind == 'education':
            out.append('<h2>%s</h2>' % e(title))
            for i in c['education']['items']:
                out.append('<article><h3>%s</h3>' % e(i['school']))
                out.append(p('%s, %s, %s' % (i['degree'], i['dates'], i['line'])))
                out.append('</article>')
        elif kind == 'articles':
            out.append('<h2>%s</h2>' % e(title))
            for a in c['articles']['items']:
                if a.get('link'):
                    out.append('<h3><a href="%s">%s</a></h3>' % (e(a['link']), e(a['title'])))
                else:
                    out.append('<h3>%s</h3>' % e(a['title']))
                    out.append(p(c['articles']['soon']))
        elif kind == 'outside':
            out.append('<h2>%s</h2>' % e(title))
            out.append('<ul>' + ''.join('<li><img src="%s" alt="%s" width="300" height="300"> %s</li>' % (e(o['src']), e(o['alt']), e(o['caption'])) for o in c['outside']['items']) + '</ul>')
            out.append(p(c['outside']['line']))
        elif kind == 'contact':
            k = c['contact']
            out.append('<h2>%s</h2>' % e(title))
            out.append(p(k['text']))
            out.append('<ul>')
            out.append('<li>Email: <a href="mailto:%s">%s</a></li>' % (e(k['email']), e(k['email'])))
            out.append('<li>LinkedIn: <a href="%s">%s</a></li>' % (e(k['linkedin']['href']), e(k['linkedin']['value'])))
            out.append('<li>Resume: <a href="%s">%s</a></li>' % (e(k['resume']['href']), e(k['resume']['label'])))
            out.append('</ul>')
        out.append('</section>')
    return '\n'.join(out)


static = build_static(c)

# ---- 3. structured data ----
site = c['site']
person = {
    "@context": "https://schema.org",
    "@type": "Person",
    "name": site['name'],
    "alternateName": "Sara",
    "url": "https://bhummika.github.io/",
    "image": "https://bhummika.github.io/" + c['intro']['photo']['src'],
    "email": "mailto:" + c['contact']['email'],
    "address": {"@type": "PostalAddress", "addressLocality": "Seattle", "addressRegion": "WA", "addressCountry": "US"},
    "alumniOf": [
        {"@type": "CollegeOrUniversity", "name": "University of Washington, Michael G. Foster School of Business"},
        {"@type": "CollegeOrUniversity", "name": "St. Francis College for Women"}
    ],
    "worksFor": {"@type": "Organization", "name": "Uber"},
    "sameAs": [c['contact']['linkedin']['href']],
    "description": site['description']
}
ld = '<script type="application/ld+json">\n' + json.dumps(person, indent=2, ensure_ascii=False) + '\n</script>'

path = os.path.join(here, 'index.html')
with open(path, encoding='utf-8') as f:
    html = f.read()

html = re.sub(r'<!--STATIC-START-->.*?<!--STATIC-END-->', lambda m: '<!--STATIC-START-->\n' + static + '\n<!--STATIC-END-->', html, flags=re.S)
html = re.sub(r'<!--LD-START-->.*?<!--LD-END-->', lambda m: '<!--LD-START-->\n' + ld + '\n<!--LD-END-->', html, flags=re.S)
html = re.sub(r'<title>.*?</title>', '<title>%s</title>' % e(site['title']), html, count=1, flags=re.S)
html = re.sub(r'<meta name="description" content="[^"]*">', '<meta name="description" content="%s">' % e(site['description'], quote=True), html, count=1)
html = re.sub(r'<meta property="og:title" content="[^"]*">', '<meta property="og:title" content="%s">' % e(site['title'], quote=True), html, count=1)
html = re.sub(r'<meta property="og:description" content="[^"]*">', '<meta property="og:description" content="%s">' % e(site['description'], quote=True), html, count=1)

with open(path, 'w', encoding='utf-8') as f:
    f.write(html)

words = len(re.sub(r'<[^>]+>', ' ', static).split())
print('content.js updated; static HTML written (%d words)' % words)
