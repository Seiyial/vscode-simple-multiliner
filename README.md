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
