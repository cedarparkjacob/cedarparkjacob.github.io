# Zero Out Solo Mode

This isolated application uses Firebase Realtime Database path `soloGames/{six-character-code}`, separate from Team Mode's `games/{code}`.

## Firebase rules prerequisite

The repository does not contain the deployed Realtime Database rules. The currently known rules authorize `games/$gameCode` only, so the new `soloGames` path will be denied until an equivalent rule is added in Firebase Console.

Add a narrowly scoped sibling rule under the root rules object; do not change the global default-deny rules:

```json
"soloGames": {
  "$gameCode": {
    ".read": "$gameCode.matches(/^[A-Z0-9]{6}$/)",
    ".write": "$gameCode.matches(/^[A-Z0-9]{6}$/) && newData.exists()",
    ".validate": "newData.hasChildren(['started', 'teams'])"
  }
}
```

Keep the existing team validation requirements as well: every team includes `id`, `letter`, `name`, `emoji`, `score`, and `position`. The Solo app writes those fields. Publish the rules in Firebase Console before trying to create or join a Solo game.
