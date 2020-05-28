"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Messages = {
    RULES: 'Please remember the channel rules: 1. Be kind 2. No politics or religion 3. No spam 4. Only backseat if I ask for it.',
    WHY: 'Why @{name}, why???',
    QUOTE: '"{quoteText}" - Added by @{nameAdded} on {dateAdded}',
    NO_QUOTES: 'No quotes available',
    DEATH: '{name} has died embarrassingly {deathCount} times on stream!',
    BOOP: '{name} booped the snoot! The snoot has been booped {boopCount} times.',
    BOOP_LEADERBOARD: 'Top Boopers:',
    BOOP_PLACEMENT: ' {placementNumber}. @{name}: ${score} boops,',
    COMMAND_EXISTS: 'Command already exists.',
    COMMAND_ADDED: 'Command !{command} added!',
    COMMAND_DELETED: 'Command deleted.',
    COMMAND_NOT_FOUND: 'Command not found.',
    COUNTER_SET: '{counter} set to {count}.',
};
exports.Messages = Messages;
function AssembleTemplatedString(templateString, templateArgs = {}) {
    const handlerFunction = new Function('templateArgs', 'const assembler = ( ' +
        Object.keys(templateArgs).join(', ') +
        ' ) => ' +
        '`' +
        templateString +
        '`;' +
        'return assembler(...Object.values(templateArgs));');
    return handlerFunction(templateArgs);
}
exports.AssembleTemplatedString = AssembleTemplatedString;
