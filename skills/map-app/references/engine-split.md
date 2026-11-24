# UI vs engine — the split that the protect hook enforces

`engine-paths.json` is a safety device, not paperwork. A false positive blocks the port; a
false negative lets the agent rewrite logic it does not understand.

## The heuristic (`scripts/lib/scan-app.mjs`)

A Kotlin file scores as UI when its path or content says so:

- path: `ui/`, `presentation/`, `screen/`, `compose/`, `component/`, `theme/` (+2 each)
- name: `*Screen.kt`, `*View.kt`, `*Ui.kt`, `Theme/Colors/Typography/Shapes/Dimens` (+2 each)
- content: `@Composable` (+3)

It scores as engine when:

- path: `data/`, `domain/`, `repository/`, `database/`, `dao/`, `network/`, `api/`, `service/`,
  `media/`, `player/`, `engine/`, `core/`, `di/` (+2 each)
- name: `*Repository`, `*RepositoryImpl`, `*DataSource`, `*Dao`, `*Database`, `*Service`,
  `*UseCase`, `*Client`, `*Engine`, `*Player`, `*Manager`, `*Module`, `*Mapper`, `*Entity` (+2)
- content: `@Dao`, `@Entity`, `@Module`, `@Provides`, `@Singleton`, `@Inject`, or an interface
  named `*Repository|*DataSource|*UseCase` (+2/+3)

Highest score wins; a tie falls back to `@Composable` presence, then `shared`.

## Glob shape

A directory becomes one glob (`core/data/**`) **only when every Kotlin file in it is engine
code**. Mixed directories are protected file by file. Protecting a whole module is never
correct for a UI port — the plugin exists to add UI inside those modules.

## Exceptions to decide with the user

| Path | Default | Why it is arguable |
| --- | --- | --- |
| `ui/navigation/**` | protected | routes whose ViewModel and screen are wired in the graph; changing a destination is a wiring change |
| `ui/theme/**` | not protected | a redesign legitimately replaces the theme |
| `di/**` | protected | registering a new ViewModel is a real engine edit; ask, do not sneak |
| `*/build/**` | never protected, never read | generated |
| `androidApp/**` | case by case | may hold only `MainActivity` (UI) plus services (engine) |

## Approving edits

If the port genuinely needs an engine edit (for example a repository must expose a field the
new UI shows):

1. The hook blocks and tells the agent to ask.
2. The agent asks once, naming the files and the reason.
3. On approval, set `protectedPathsApproved: true` in `.uiport/state.json` **and** write the
   approval, the files and the reason into the worklog. The flag is per run, not permanent:
   a new run must ask again.
