import * as vscode from 'vscode'
import { splatIndentableCommand } from './commands/splatIndentable'

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	let disp = vscode.commands.registerCommand('syl.vscode-multiliner.spread1', splatIndentableCommand)
	console.log('are we running?')
	context.subscriptions.push(disp)
}

// this method is called when your extension is deactivated
export function deactivate() {}
