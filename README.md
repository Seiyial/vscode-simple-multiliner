# Simple expression multiliner (beta)

### What it does

Turns this:
```dart
// dart
final bundle = APIMessageBundle(messages: messages, title: title, mostRecentMsgDT: mostRecentMsgDT, type: type);
```
```ts
// JS/TS
const a: B = {c: 'd', e: 'f'}
const someFn = (arg1: string, arg2: number, arg3: User) => {}
```

Into This:

(obeys the indentation rules of the current file being edited (shown at the bottom right), be it 2-size tab, 2-spaces, 4-spaces or even 3-size tab)

```dart
// dart
final bundle = APIMessageBundle(
  messages: messages,
  title: title,
  mostRecentMsgDT: mostRecentMsgDT,
  type: type
);
```
```ts
// JS/TS
const a: B = {
    c: 'd',
    e: 'f'
}
const someFn = (
    arg1: string,
    arg2: number,
    arg3: User
) => {

}
```

### What it doesn't do (yet)

- Discriminate which blocks are meant to be multilined and which aren't. Essentially, may not be able to handle complex statements.
- Pull requests that help it support more complex statements/features without hurting existing support will all be welcome!

### How to map to keybindings

- Open command palette (default: cmd/ctrl + shift + p) and find **Preferences: Open Keyboard Shortcuts (JSON)**
- Add an entry into the JSON array, and set the `key` to your preferred key combination.
	```JSON
	{
		"key": "cmd+]",
		"command": "syx-simple-multiliner.spread"
	}
	```
