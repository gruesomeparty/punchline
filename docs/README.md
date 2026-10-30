# docs/

Shareable project documentation. **This repository is public: only Markdown is committed here.**

## Sensitive material lives elsewhere

HAR files, DevTools Recorder exports, HTML snapshots, screenshots of HRworks or Harvest, and
internal prompts contain session cookies, tokens, names and working hours. They live in the
private **`punchline-internal`** repository, cloned next to this one:

```sh
cd ..   # the folder that contains punchline/
git clone https://github.com/gruesomeparty/punchline-internal.git
```

```
work/
├── punchline/            # this repo (public)
└── punchline-internal/   # private: recordings, HAR files, snapshots, prompts
```

> [!CAUTION]
> Even in the private repo, strip live cookies and tokens from HAR files before committing.
> A private repo limits who can read data. Session secrets should still not be stored there.

## Safety net

If such a file ends up in this folder anyway, it is git-ignored (everything except `*.md`),
and both the pre-commit hook and CI (`npm run check:files`) reject it even if force-added.
Before you quote an excerpt in an issue or PR, strip cookies, tokens, names and IDs.
