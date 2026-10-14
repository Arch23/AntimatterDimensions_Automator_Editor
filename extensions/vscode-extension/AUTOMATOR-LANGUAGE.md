# Antimatter Dimensions Automator Language Reference

This document describes the Automator script syntax covered by this project, based on the supplied `sintax.txt` and `keywords.txt` references. It also documents this extension's optional snippet preprocessor. The game's Automator remains the authority on whether a command can run in the current game state.

Each script is limited to 10,000 characters. The VS Code extension reports an error when an editor script exceeds this per-script limit. Its count normalizes line endings and omits empty lines to match the in-game count; indentation and other characters on nonempty lines are included. The combined 60,000-character limit and 15-character script-name limit apply to scripts saved in the game and are not checked by the editor extension.

## Extension snippets (preprocessor)

Snippets are an editor/build feature, not native Automator syntax. A main source script may use `.automator` or the shorter `.aut` extension. Store reusable snippet files in a folder named `ext` beside the main script, with either a `.snippet` or `.snpt` extension:

```text
MyScript.aut
ext/
  restore.snippet
  wait-ready.snpt
```

Insert a snippet using its filename without the extension, wrapped in braces:

```automator
{restore}
wait ep >= 1e100
{wait-ready}
```

Snippet names may contain letters, digits, underscores, and hyphens. Snippets can include other snippets; references are recursively expanded. Circular references and missing snippet files are build errors. If both `name.snippet` and `name.snpt` exist, `.snippet` is selected.

Use **Automator: Build Script (Expand Snippets)** from the Command Palette or the editor title bar. The expanded result is written beside the source as `<source-name>.built.automator`; for example, `MyScript.aut` builds to `MyScript.built.automator`. The source file is not overwritten. If that output already exists, VS Code asks before replacing it. A build is refused if the expanded script exceeds the game's 10,000-character per-script limit.

While editing a main script, the status bar shows the source and expanded character counts when snippets are present. It recalculates when the main script or an open snippet in its `ext` folder changes. The snippet reference token has a distinct syntax-highlighting scope to distinguish it from native Automator code.

## Syntax notation

- Words written literally, such as `studies` and `purchase`, are command text.
- A name such as `study_list`, `selector`, or `interval` stands for a value you provide; do not type the placeholder itself.
- Square brackets indicate an optional part. For example, `[nowait]` means you may omit or include `nowait`; do not type the square brackets.
- `|` separates alternatives.
- Unless a command says otherwise, command words and inputs are case-insensitive. A preset name supplied to `studies load name` is case-sensitive.

## Script structure

A script is a sequence of commands, one command per line. Blank lines are permitted.

### Comments

Use `#` or `//` at the start of a line to add a comment:

```automator
# Prepare for the next challenge
// The Automator skips comment lines
```

Comments must occupy their own line. Inline comments after a command are not supported. Comments do not count as commands or slow script execution.

### Blocks

`if`, `until`, and `while` have command blocks. Put the opening `{` on the same line as the condition and the closing `}` on a line of its own. Blocks may contain other commands and may be nested.

```automator
if ep > 1e6000 {
  unlock ec10
  start ec10
}
```

## Values and comparisons

### Numeric values

Numbers may be written as ordinary or scientific-notation values, such as `1000`, `1e100`, or `1.8e308`. Most currencies are large enough that scientific notation is useful.

### Currencies and resources

The following resources can be used in comparisons:

| Resource | Meaning |
| --- | --- |
| `am` | Current Antimatter |
| `ip` | Current Infinity Points |
| `ep` | Current Eternity Points |
| `rm` | Current Reality Machines |
| `infinities` | Current Infinity count |
| `banked infinities` | Current Banked Infinity count |
| `eternities` | Current Eternity count |
| `realities` | Current Reality count |
| `pending ip` | IP gained on Infinity, or 0 if unavailable |
| `pending ep` | EP gained on Eternity, or 0 if unavailable |
| `pending tp` | TP gained on exiting Dilation |
| `pending rm` | RM gained on Reality, or 0 if unavailable |
| `pending glyph level` | Glyph Level gained on Reality, or 0 if unavailable |
| `dt` | Current Dilated Time |
| `tp` | Current Tachyon Particles |
| `rg` | Current Replicanti Galaxies; this does not use scientific notation |
| `rep` | Current Replicanti |
| `tt` | Current Time Theorems |
| `total tt` | Total Time Theorems, including generated theorems and those spent on Studies |
| `spent tt` | Time Theorems currently spent on Time Studies |
| `total completions` | Total completions of all Eternity Challenges |
| `pending completions` | Completions of the current Eternity Challenge on Eternity |
| `ecN completions` | Completions for one Eternity Challenge, for example `ec6 completions` |

Defined constants from the game's Automator definitions panel may also be used where a value is accepted.

A comparison has two single values and one inequality operator:

```text
resource operator resource
```

Supported operators are `<`, `<=`, `>`, and `>=`. Equality operators (`==`, `!=`) are not supported. Arithmetic expressions such as `ip + pending ip` are not supported.

```automator
ep < 1e20
total tt > 14000
myThreshold > am
```

## Commands

### Time Studies

#### Enable respec for the next Eternity

```text
studies respec
```

This enables Time Study respec for the next manual or automatic Eternity; it does not trigger an Eternity by itself. The `eternity respec` prestige command is an alternative when triggering Eternity from the script.

#### Load a preset

```text
studies [nowait] load id selector
studies [nowait] load name name
```

`selector` is a preset slot from 1 to 6. `name` is a case-sensitive preset name. Without `nowait`, the command keeps trying until all studies in the preset are purchased and can leave the script waiting indefinitely. With `nowait`, it purchases as many as possible and then continues.

```automator
studies load id 2
studies load name ANTI
studies nowait load name dil
```

#### Purchase studies

```text
studies [nowait] purchase study_list[|ec_number[!]]
```

`study_list` may be a comma-separated list of exported Time Study IDs. Exported choice-study entries may include a pipe and choice index, such as `171|0`. Flexible lists also allow ranges and these aliases: `antimatter`, `infinity`, `time`, `active`, `passive`, `idle`, `light`, and `dark`. Append `|N` (where N is 1–12) to unlock that Eternity Challenge along with the studies; append `!` after the number to start it too. A defined variable can still replace the entire study list, including when followed by this suffix. If a variable contains an Eternity Challenge, a `|` written in the command takes precedence over it.

A defined variable can replace the entire study list, but aliases and shorthand ranges cannot be combined with a variable. As with preset loading, `nowait` determines whether the command waits and retries to purchase further studies or continues after purchasing as many as possible.

```automator
studies nowait purchase 11,21,31
studies purchase 11-62, antimatter, 111, idle
studies nowait purchase ec6Studies
studies purchase firstRows, 181|12!
```

### Prestige, unlock, and start

#### Trigger a prestige

```text
infinity [nowait]
eternity [nowait] [respec]
reality [nowait] [respec]
```

Triggers the requested reset when possible. Without `nowait`, the command waits and retries until it can trigger. With `nowait`, it moves on if the prestige is not possible. `respec` is available for Eternity and Reality: Eternity respeccs Time Studies; Reality unequips Glyphs.

```automator
infinity
eternity respec
reality nowait
```

#### Unlock a feature

```text
unlock [nowait] feature
```

`feature` is an Eternity Challenge (`ec1` through `ec12`) or `dilation`. By default, the command retries until the unlock succeeds; `nowait` makes it continue if the unlock fails.

```automator
unlock dilation
unlock ec7
```

#### Start an Eternity Challenge or Dilated Eternity

```text
start ecN
start ec N
start dilation
```

Eternity Challenges may be written compactly (`ec11`) or with a separating space (`ec 11`), as in the game's templates. Starting an Eternity Challenge also attempts to unlock it if needed. Starting Dilation does not unlock it; use `unlock dilation` first. The command retries until it succeeds. If already in the requested challenge or Dilated Eternity, it does nothing.

```automator
start ec12
start dilation
```

### Autobuyers and Black Hole

#### Set or toggle an autobuyer

```text
auto infinity [setting]
auto eternity [setting]
auto reality [setting]
```

With no setting, the command toggles the selected prestige Autobuyer. Available settings are:

| Setting | Availability | Effect |
| --- | --- | --- |
| `on` or `off` | All three Autobuyers | Turns the Autobuyer on or off |
| `number` followed by a time unit | Infinity and Eternity | Turns it on and sets its interval |
| `number x highest` | Infinity and Eternity | Turns it on in "X times highest" mode |
| `number` followed by the matching currency (`ip`, `ep`, or `rm`) | Matching Autobuyer | Turns it on at that currency amount |

Time units include `ms`, `s`, `sec`, `seconds`, `m`, `min`, `minutes`, `h`, and `hours`. A currency threshold must match the Autobuyer: Infinity uses `ip`, Eternity uses `ep`, and Reality uses `rm`. Reality Autobuyer Glyph Level mode cannot be set with this command. The command cannot change Autobuyers or settings that are not unlocked.

```automator
auto infinity on
auto eternity off
auto infinity 30s
auto eternity 10 seconds
auto eternity 1e100 x highest
auto reality 1e100 rm
```

#### Toggle Black Hole speedup

```text
black hole on
black hole off
```

This toggles the Black Hole speedup effect. Turning it on through the Automator does not skip its gradual acceleration.

### Notifications

```text
notify "text"
```

Displays the quoted text as a notification in the top-right corner.

```automator
notify "Dilation reached"
```

### Waiting and pauses

#### Wait for a condition or event

```text
wait condition
```

`condition` can be:

- A comparison, which waits until it becomes true.
- A prestige event: `infinity`, `eternity`, or `reality`. This waits for the corresponding Autobuyer to trigger after the command is reached. If it triggers before the script reaches this line, the script may wait indefinitely.
- A Black Hole state: `black hole off`, `black hole bh1`, or `black hole bh2`. `off` means no Black Hole is active; `bh1` means at least the first is active; `bh2` means both are active.

```automator
wait am >= 1e308
wait pending completions >= 5
wait ec9 completions >= 4
wait infinity
wait black hole bh1
```

#### Pause for a duration

```text
pause interval
```

`interval` is a number with a unit (`ms`, `s`, `sec`, `seconds`, `m`, `min`, `minutes`, `h`, or `hours`) or a defined constant. A constant is interpreted as seconds. A unit is required when supplying a number directly.

```automator
pause 10s
pause 1 minute
pause 34 seconds
```

Short pauses may not take effect until the next Automator execution tick. During offline progress, pauses may behave differently due to limited tick counts. You can manually step past a pause in the game's Automator controls.

### Conditional and loop blocks

#### `if`

```text
if comparison {
  commands
}
```

Runs the block only if its comparison is true when execution reaches the `if`. Otherwise, execution skips to the line after the block.

#### `while`

```text
while comparison {
  commands
}
```

Repeats the block while its comparison is true. The comparison is checked at the start and each time the loop repeats. If it is initially false, the block is skipped.

#### `until`

```text
until comparison {
  commands
}
```

Repeats the block until its comparison is true. The condition is checked before each iteration; if already true at the start, the block is skipped.

`until` also accepts a prestige event:

```text
until prestige_event {
  commands
}
```

For example, `until reality` enters the block and repeats until a Reality occurs after entering it. If the event occurs during an iteration, the rest of that iteration's block still runs before the loop exits.

#### `stop`

```text
stop
```

Stops Automator execution, as if the stop control were pressed. It can be used inside a block to stop only when that block's condition is met.

## Complete example

```automator
# Wait until enough EP is available, then work on EC10
wait ep >= 1e6000

if ec10 completions < 5 {
  unlock ec10
  start ec10
  until reality {
    studies nowait purchase 11-62, time
    pause 10s
    eternity respec
  }
}
```
