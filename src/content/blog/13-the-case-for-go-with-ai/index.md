---
title: "The Case for Go When You Code With an AI Agent"
description: "Go is the language I've fought least while building alongside an AI agent. The benchmarks mostly disagree with me. Here's the case anyway, with the numbers that cut against it left in."
date: "2026-07-12"
---

I rewrote my eBay scraper from Python to Go last week and let an agent do most of the typing. It took a weekend. The Go version drains 57,077 listings in 8 minutes on a rented box with 954MB of RAM.

That lined up with a feeling I'd had for months, that Go is the language I fight least when an agent is the one writing it. So I went looking for the evidence, fully expecting to find a pile of it sitting there.

There isn't one. The evidence is mixed, a good chunk of it points the other way, and the stat I most wanted to open with turns out to be someone's invention. I'm making the case anyway, because I still believe the case. But it's a case, not a proof, and I'd rather hand you the parts that undercut me than have you go find them yourself.

> **Key Takeaways**
> - Language choice still changes what an agent produces. Across 34 agent-built chess engines in 17 languages, strong results only came from mainstream compiled languages ([Acher & Jézéquel, 2026](https://arxiv.org/abs/2606.13763)).
> - The benchmarks do not crown Go. It ranks mid-to-low on agentic issue-resolution and below Python on isolated function generation.
> - The largest agent benchmark run on frontier models is the exception: SWE-Bench Pro finds Go and Python the two strongest languages ([Scale, 2025](https://arxiv.org/abs/2509.16941)).
> - My hypothesis for the gap between the numbers and my experience: corpus coherence beats corpus size. JavaScript has ~20x Go's training data and ranks at the bottom.
> - What I'm actually buying is a fast, cheap correction loop. `go build` fails in under a second and tells the agent exactly what's wrong.

## The language still matters, and now there's a study

Researchers gave Claude Code and Codex a single instruction, build a chess engine, with no chess knowledge and no implementation guidance attached. The agents came back with 34 engines across 17 languages, ranging from mainstream to legacy to genuinely obscure.

They could write all of them. But the engines that actually played strong chess only came out of mainstream compiled languages, cost and effort climbed steeply the further the target drifted from the mainstream, and even the features the agent chose to implement shifted depending on the language family ([Acher & Jézéquel, 2026](https://arxiv.org/abs/2606.13763)).

Go was not one of the 17 languages they tested. So the study supports "pick a mainstream compiled language" and nothing narrower than that. I'm citing it for that claim only.

## The agent will pick Python for you if you let it

Ask for a script without naming a language and you'll get Python or JavaScript almost every time. That isn't a judgment about your task. Researchers found models pick Python 58% of the time even when it's a poor fit, and across their entire study Rust was never chosen once ([Twist et al., 2025](https://arxiv.org/abs/2503.17181)).

That preference is inherited from the training corpus, which is mostly a reflection of whatever GitHub happens to contain. Popularity in a scraped dataset isn't fitness for your job. Leave the choice open and the default quietly picks your architecture for you.

## What the benchmarks actually say

They say Go is middling. On SWE-bench Multilingual, where an agent fixes real GitHub issues, Go lands second from the bottom:

| Language | Issues resolved |
|---|---|
| Rust | 58.1% |
| Java | 53.5% |
| PHP | 48.8% |
| Ruby | 43.2% |
| JavaScript / TypeScript | 34.9% |
| **Go** | **31.0%** |
| C / C++ | 28.6% |

Source: [SWE-bench Multilingual](https://www.swebench.com/multilingual.html), 300 tasks, SWE-agent with Claude 3.7 Sonnet.

Two caveats before anyone quotes that back at me. Each language gets about 42 tasks, which puts Go's 31% inside a confidence interval of roughly 17% to 45%. Run the numbers and only Rust and Java beat Go by a margin that survives the noise. PHP, Ruby, JavaScript and C++ are all statistically tied with it.

It gets worse elsewhere. On Multi-SWE-bench, a larger issue-resolving benchmark, Go scores somewhere between 4.4% and 7.5% depending on the agent, while Java manages around 21% ([ByteDance Seed, 2025](https://arxiv.org/abs/2504.02605)). On McEval's generation task, GPT-4o solves 62.0% of Go problems against 76.0% of Python and 83.0% of Rust ([McEval, 2024](https://arxiv.org/abs/2406.07436)).

One benchmark cuts the other way, and it happens to be the biggest and the most modern. SWE-Bench Pro runs 1,865 long-horizon tasks against frontier models and reports Go and Python with the highest resolve rates across most of them, with JavaScript and TypeScript the weakest ([Scale, 2025](https://arxiv.org/abs/2509.16941)).

So the scoreboard is split. The data doesn't prove Go is the best language for agents, and I'm not going to pretend it does.

## Why more data isn't automatically better data

The rest of this section is my own explanation, not a finding, and I'd like that noted before you read it.

The usual story goes that models are good at Python because Python is everywhere in the training data, and weaker at Go because there's less of it. That story breaks on its own evidence. JavaScript has roughly 1,115GB in The Stack v2 against Go's 55GB, about twenty times more, and JavaScript sits at the bottom of both agentic benchmarks. Rust has 15GB, three and a half times less than Go, and tops the charts.

So volume isn't the variable. My guess is that coherence is.

Python's corpus is enormous and at war with itself. It spans Python 2 and Python 3, six competing libraries for any given task, and a decade of shifting practice. This part isn't a vibe, it's measured. An ICSE 2025 study tested seven LLMs against 145 API mappings across eight popular Python libraries and 28,125 prompts, and every model struggled with deprecated APIs. The reason is the obvious one: deprecated usages sit in the training data, and the model has no deprecation knowledge at inference time ([Wang et al., ICSE 2025](https://arxiv.org/html/2406.09834v1)). If the old API appears more often than its replacement, the model reaches for the old one. There's an entire benchmark, GitChameleon, built for nothing but testing generated code against Python library version incompatibilities ([GitChameleon, 2025](https://arxiv.org/html/2507.12367v2)). Nobody has needed to build that for Go.

Go's corpus is smaller and much more uniform. One formatter, so every file looks the same. A deep standard library, so most code depends on nothing. One obvious way to do most things. And the Go 1 compatibility promise, which means Go written in 2015 still compiles today ([Go 1 compatibility](https://go.dev/doc/go1compat)). A third of the training data, and it mostly agrees with itself.

The same logic would explain JavaScript, whose corpus is about the least coherent thing in software. jQuery and React, CommonJS and ES modules, four eras of idiom stacked on top of each other. Twenty times the data and it still sits at the bottom of the table.

There's a hint of the same effect in the language research, where a large high-resource corpus is described as bringing interference from lower-quality data, while a smaller corpus with a uniform feature distribution gives a cleaner signal. That work is about natural languages rather than code, so treat it as an analogy and not much more.

It's also worth noticing which benchmarks Python wins. It wins the isolated-function tests, where there are no libraries, no versions and no idiom drift to trip over, which are exactly the conditions under which a messy corpus costs you nothing. Move to whole repositories with real dependencies and the lead stops being obvious.

Nobody has measured corpus coherence as a variable for code models, so this is a guess. It's my explanation for why the numbers and my experience disagree, it fits the two anomalies better than the volume story does, and it could still be wrong.

## What a small, consistent language looks like in practice

Take one task, pull the names out of a list of users. Python offers at least four valid ways, and an agent will happily mix them across a single file:

```python
names = [u.name for u in users]              # comprehension
names = list(map(lambda u: u.name, users))   # map
names = (u.name for u in users)              # generator, subtly different
names = []
for u in users:                              # plain loop
    names.append(u.name)
```

Go offers one:

```go
names := make([]string, 0, len(users))
for _, u := range users {
	names = append(names, u.Name)
}
```

Not elegant. But agent-written Go looks like agent-written Go from last week, and like mine, and the cost of reading a diff drops when the code only has one accent.

Error handling is the sharpest split. In Python, three things can throw in this one line, and where each of them gets caught is invisible from where you're standing:

```python
def load(url):
    return requests.get(url).json()["price"]   # network? bad JSON? missing key?
```

In Go every failure is a value, named at the point it happens:

```go
func load(url string) (float64, error) {
	resp, err := http.Get(url)
	if err != nil {
		return 0, fmt.Errorf("get %s: %w", url, err)
	}
	defer resp.Body.Close()

	var body struct {
		Price float64 `json:"price"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return 0, fmt.Errorf("decode %s: %w", url, err)
	}
	return body.Price, nil
}
```

The agent can't quietly skip a failure path here, because every one of them is a value it has to deal with in front of you. It's verbose, obviously. The agent types the `if err != nil`, not me, so I've stopped caring about that.

## The thing I'm actually buying

Every benchmark up there scores the quality of the model's output, and that was never what I liked about Go. What I like is that when the agent gets something wrong I find out in under a second, for free, in a form the agent can act on.

Say it invents a method that sounds right but doesn't exist. Same bug, two languages:

```python
resp = requests.get(url)
body = resp.body()   # AttributeError, but only when this line runs
```

```go
resp, _ := http.Get(url)
body := resp.Body()  // does not compile: Body is a field, not a method
```

Go rejects that at `go build`, instantly, with a message precise enough for the agent to fix on its next turn. The Python version is an `AttributeError` that waits. It sits quiet until some rare branch runs, which for a cron job means it surfaces at 3am on a listing that shows up once a month.

The same gap shows up reading JSON, which is most of what a scraper does. Python hands you a dict where every key access is a bet:

```python
data = resp.json()
price = data["price"]                    # KeyError if renamed or absent
title = data["itemSummary"]["title"]     # and again, one level deeper
```

Go decodes into a typed struct declared once, so no key surprises you later:

```go
var listing struct {
	Price       float64 `json:"price"`
	ItemSummary struct {
		Title string `json:"title"`
	} `json:"itemSummary"`
}
_ = json.NewDecoder(resp.Body).Decode(&listing)
```

The research backs the mechanism even where it doesn't back the league table. Type-constrained generation cuts compiler errors by 74.8% on HumanEval and lifts the repair rate for non-compiling code from 33.5% to 56.4% ([Mündler et al., PLDI 2025](https://arxiv.org/abs/2504.09246)). In a separate study, feeding compiler errors back to GPT-5 took it from 22 of 56 tasks to 54 of 56, and compiler feedback beat execution feedback ([Li & Krishnamachari, 2026](https://arxiv.org/abs/2602.11481)).

`go build`, `go vet` and `go test` give me that loop by default, in seconds, on every save. A weaker first draft that fails loudly and cheaply is worth more to me than a stronger one that fails silently in production three weeks later. The agent iterates for free. I'm the one who pays for the failures it doesn't catch.

## The footprint, which has nothing to do with any of this

One honest separation before I get accused of smuggling it in. Go's memory footprint has no connection to how well an agent writes Go. No benchmark links the two and I'm not going to imply one. It's just why the finished thing runs where I want it to.

A goroutine starts at about 2KB of stack, so a thousand of them cost roughly 2MB. A thousand OS threads can run past a gigabyte ([CloudInsight, 2025](https://cloudinsight.cc/en/blog/python-golang-high-concurrency)).

<figure style="margin: 2.5rem 0;">
<svg viewBox="0 0 600 240" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Bar chart comparing memory for 1,000 concurrent tasks: about 2MB for Go goroutines versus roughly 1,000MB for OS threads, based on CloudInsight 2025.">
  <rect width="600" height="240" fill="#0f172a" rx="10"/>
  <text x="300" y="26" fill="#e2e8f0" font-size="13" font-family="system-ui,sans-serif" text-anchor="middle" font-weight="600">Memory for 1,000 concurrent tasks</text>
  <line x1="140" y1="60" x2="140" y2="180" stroke="#334155" stroke-width="1"/>
  <line x1="140" y1="180" x2="560" y2="180" stroke="#334155" stroke-width="1"/>
  <rect x="140" y="88" width="4" height="24" fill="#4f8ef7" rx="1"/>
  <text x="152" y="104" fill="#cbd5e1" font-size="12" font-family="system-ui,sans-serif">Go goroutines: ~2MB</text>
  <rect x="140" y="132" width="400" height="24" fill="#f74f4f" rx="1"/>
  <text x="152" y="148" fill="#0f172a" font-size="12" font-family="system-ui,sans-serif" font-weight="600">OS threads: ~1,000MB</text>
  <text x="300" y="212" fill="#64748b" font-size="10" font-family="system-ui,sans-serif" text-anchor="middle">Source: CloudInsight, Python vs Golang High Concurrency, 2025</text>
</svg>
</figure>

My scraper server has 954MB of RAM and 2GB of swap. The old Python version lived in swap and thrashed the disk every cycle. The Go one sits at about 450MB and never touches it. Same box, same job. It also deploys as one static binary, so there's no interpreter to install and no `pip install` that breaks on the server because some wheel won't build.

## Where I might be wrong

Plenty of places, and they're worth listing out.

The typing argument doesn't survive contact with its own table. PHP and Ruby are dynamically typed and interpreted, and both beat Go on the SWE-bench Multilingual numbers I quoted above. If "statically typed and compiled" were the thing that mattered, that couldn't happen. Rust probably wins on compiler quality and a rigid idiom culture rather than static typing on its own, and Go's type system doesn't buy it a rank advantage anywhere I can find.

Self-repair loops aren't magic either. Once you account for what the repair iterations cost, the gains are modest, they vary between task sets, and sometimes they aren't there at all, because the loop is bottlenecked by the quality of the feedback rather than its existence ([Olausson et al., ICLR 2024](https://arxiv.org/abs/2306.09896)). A compiler that says "cannot use x (type int) as type string" teaches an agent a lot less than rustc does.

The gap may also be closing without anyone's help. On Multi-LCB, a small model shows a 20-point Python-over-Go advantage, while a stronger one shows 1.2 points, Python 71.1 against Go 69.9 ([Multi-LCB, 2026](https://arxiv.org/pdf/2606.20517)). If that trend holds, the corpus argument matters less every year.

And the biggest hole in all of it: not one of these benchmarks measures what I actually did. They score agents fixing bugs in existing repositories, or writing isolated functions. None of them measures an agent building a new system from scratch, which is the only thing I have real experience of. The one greenfield study, the chess engines, didn't test Go. So there's no published evidence on the exact thing I'm claiming, in either direction, and my own evidence is one rewrite, on one project, by one person.

## So, the case

Go isn't the language agents are measurably best at. Python probably writes cleaner in one shot, and Java and Rust resolve more real issues in existing codebases. Pick by leaderboard alone and you shouldn't pick Go.

What Go gives me is a language whose training data mostly agrees with itself, one idiom to review instead of four, a compiler that turns the agent's mistakes into an error in under a second, and a binary that runs in 450MB on a box I barely pay for. The verbosity that used to be the argument against all of that is now typed by something that doesn't get bored.

That's the case. It rests on one rewrite and a hypothesis I can't prove, and the leaderboards don't back it up. I'm still writing my next service in Go.

Sources: [Do programming languages still matter to your AI coding agent teammate? (Acher & Jézéquel, 2026)](https://arxiv.org/abs/2606.13763), [SWE-bench Multilingual](https://www.swebench.com/multilingual.html), [Multi-SWE-bench (ByteDance Seed, 2025)](https://arxiv.org/abs/2504.02605), [SWE-Bench Pro (Scale, 2025)](https://arxiv.org/abs/2509.16941), [McEval (2024)](https://arxiv.org/abs/2406.07436), [Multi-LCB (2026)](https://arxiv.org/pdf/2606.20517), [A Study of LLMs' Preferences for Libraries and Programming Languages (Twist et al., 2025)](https://arxiv.org/abs/2503.17181), [LLMs Meet Library Evolution (ICSE 2025)](https://arxiv.org/html/2406.09834v1), [GitChameleon (2025)](https://arxiv.org/html/2507.12367v2), [Type-Constrained Code Generation (PLDI 2025)](https://arxiv.org/abs/2504.09246), [Compiler-Guided Inference-Time Adaptation (2026)](https://arxiv.org/abs/2602.11481), [Is Self-Repair a Silver Bullet? (ICLR 2024)](https://arxiv.org/abs/2306.09896), [The Stack v2 / StarCoder 2 (2024)](https://arxiv.org/abs/2402.19173), [Go 1 compatibility promise](https://go.dev/doc/go1compat), [CloudInsight (2025)](https://cloudinsight.cc/en/blog/python-golang-high-concurrency).
</content>
</invoke>
