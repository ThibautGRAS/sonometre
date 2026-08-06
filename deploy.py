#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Déploiement du sonomètre CETIM sur GitHub Pages.

Usage :
  python3 deploy.py '<TOKEN>' ["message de commit"]
        -> DÉPLOIE LA BETA : commit local index.html/sw.js/MEMOIRE.md sur V2,
           et beta/index.html + MEMOIRE.md sur main (la prod racine n'est PAS touchée).

  python3 deploy.py '<TOKEN>' --promote [VERSION]
        -> PROMEUT LA BETA EN PRODUCTION : lit beta/index.html sur main, en fait
           la racine main/index.html sous le numéro de sortie VERSION (par défaut =
           version beta sans « -beta »), recale sw.js (cache), et fait repartir la
           beta au patch suivant (…-beta). 100 % côté git (n'utilise pas les fichiers
           locaux), donc sûr même si le poste de travail n'a pas les sources.

Le TOKEN (fine-grained PAT, droits Contents:read/write sur le dépôt) est lu en argv[1]
et n'est jamais stocké dans ce fichier.
"""
import sys, os, re, json, time, base64, hashlib, urllib.request, urllib.error

REPO = "ThibautGRAS/sonometre"
API  = "https://api.github.com/repos/" + REPO

if len(sys.argv) < 2 or not sys.argv[1]:
    print("ERREUR : token manquant.  Usage : python3 deploy.py '<TOKEN>' [--promote [VERSION] | \"message\"]")
    sys.exit(1)
TOKEN = sys.argv[1]

def gh(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(API + path, data=data, method=method, headers={
        "Authorization": "Bearer " + TOKEN, "User-Agent": "sono-deploy",
        "Accept": "application/vnd.github+json"})
    with urllib.request.urlopen(r, timeout=30) as resp:
        return json.load(resp)

def get_file(path, ref):
    return gh("GET", "/contents/%s?ref=%s" % (path, ref))

def get_text(path, ref):
    return base64.b64decode(get_file(path, ref)["content"]).decode("utf-8")

# --- commit multi-fichiers via l'API git-data (1 commit propre), repli Contents API ---
def commit_files(branch, files, message):
    """files = {chemin: texte}. Renvoie True si OK."""
    try:
        ref = gh("GET", "/git/ref/heads/" + branch)
        base = ref["object"]["sha"]
        base_commit = gh("GET", "/git/commits/" + base)
        base_tree = base_commit["tree"]["sha"]
        tree = [{"path": p, "mode": "100644", "type": "blob", "content": t} for p, t in files.items()]
        new_tree = gh("POST", "/git/trees", {"base_tree": base_tree, "tree": tree})["sha"]
        new_commit = gh("POST", "/git/commits", {"message": message, "tree": new_tree, "parents": [base]})["sha"]
        gh("PATCH", "/git/refs/heads/" + branch, {"sha": new_commit})
        print("  [%s] %d fichier(s) -> %s" % (branch, len(files), new_commit[:10]))
        return True
    except Exception as e:
        print("  git-data KO (%s) -> repli Contents API" % (getattr(e, "code", e)))
        ok = True
        for p, t in files.items():
            ok = put_contents(branch, p, t, message) and ok
        return ok

def put_contents(branch, path, text, message):
    body = {"message": message, "branch": branch,
            "content": base64.b64encode(text.encode("utf-8")).decode()}
    try:
        body["sha"] = get_file(path, branch)["sha"]
    except Exception:
        pass
    for _ in range(5):
        try:
            gh("PUT", "/contents/" + path, body)
            print("    OK %s:%s" % (branch, path))
            return True
        except urllib.error.HTTPError as e:
            if e.code in (409, 502, 503):
                time.sleep(8); continue
            raise
    print("    ECHEC %s:%s (repetes)" % (branch, path))
    return False

def splashver(html):
    return re.search(r'id="splashVer">([^<]+)<', html).group(1)

# =========================== MODE PROMOTION ===========================
if "--promote" in sys.argv:
    ver_arg = None
    for a in sys.argv[2:]:
        if a != "--promote" and not a.startswith("-"):
            ver_arg = a; break

    beta = get_text("beta/index.html", "main")
    bver = splashver(beta)                                   # ex. "2.3.1-beta"
    prod_ver = ver_arg or re.sub(r"-beta$", "", bver)        # -> "2.3.1"
    parts = prod_ver.split(".")                              # beta suivante = patch + 1
    if parts and parts[-1].isdigit():
        parts[-1] = str(int(parts[-1]) + 1)
    next_beta = ".".join(parts) + "-beta"

    tag = 'id="splashVer">' + bver + "<"
    if tag not in beta:
        print("ERREUR : version beta introuvable dans beta/index.html."); sys.exit(1)
    prod    = beta.replace(tag, 'id="splashVer">' + prod_ver + "<", 1)
    newbeta = beta.replace(tag, 'id="splashVer">' + next_beta + "<", 1)
    h8 = hashlib.sha256(prod.encode("utf-8")).hexdigest()[:8]

    sw  = get_text("sw.js", "main")
    sw2 = re.sub(r"const CACHE = '[^']+';",
                 "const CACHE = 'sono-%s-%s';" % (prod_ver, h8), sw, count=1)

    mem = get_text("MEMOIRE.md", "main")
    note = ("## 8. Journal des versions (V2)\n\n"
            "- **PROMOTION -> PRODUCTION %s** : beta %s promue en production racine sous %s ; "
            "sw.js racine recale CACHE='sono-%s-%s' ; canal beta relance en %s.\n"
            % (prod_ver, bver, prod_ver, prod_ver, h8, next_beta))
    mem2 = mem.replace("## 8. Journal des versions (V2)\n", note, 1) if "## 8. Journal des versions (V2)\n" in mem else (note + "\n" + mem)

    print("=== PROMOTION : beta %s -> PRODUCTION %s (beta relancee en %s) ===" % (bver, prod_ver, next_beta))
    ok = commit_files("main", {
        "index.html": prod,
        "sw.js": sw2,
        "beta/index.html": newbeta,
        "MEMOIRE.md": mem2,
    }, "%s : promotion beta -> production" % prod_ver)
    print("OK" if ok else "ECHEC")
    sys.exit(0 if ok else 1)

# =========================== MODE DEPLOIEMENT BETA ===========================
msg = None
for a in sys.argv[2:]:
    if not a.startswith("-"):
        msg = a; break

for f in ("index.html", "sw.js", "MEMOIRE.md"):
    if not os.path.exists(f):
        print("ERREUR : %s introuvable dans le dossier courant (deploiement beta)." % f); sys.exit(1)

idx = open("index.html", encoding="utf-8").read()
sw  = open("sw.js", encoding="utf-8").read()
mem = open("MEMOIRE.md", encoding="utf-8").read()
VER = splashver(idx)
message = msg or (VER + " : deploiement beta")

print("=== V2 : depot de dev (index.html + sw.js + MEMOIRE.md) ===")
commit_files("V2", {"index.html": idx, "sw.js": sw, "MEMOIRE.md": mem}, message)

print("=== main : beta + MEMOIRE (la prod racine n'est PAS touchee) ===")
commit_files("main", {"beta/index.html": idx, "MEMOIRE.md": mem}, message)
print("OK  (beta en ligne : /sonometre/beta/ — version %s)" % VER)
