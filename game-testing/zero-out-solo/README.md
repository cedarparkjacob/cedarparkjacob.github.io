# Zero Out Solo Mode

This isolated application uses Firebase Realtime Database path `soloGames/{six-character-code}`, separate from Team Mode's `games/{code}`.

## Firebase rules prerequisite

The currently deployed rules authorize `games/$gameCode` only. Before testing, add an equivalent narrowly scoped `soloGames/$gameCode` rule block in Firebase Console. Keep the six-character uppercase-alphanumeric key validation and require an existing game record for writes. The repository does not contain the deployed rules source, so this permission cannot be safely changed from this repository.
