const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");

initializeApp({
  databaseURL: "https://zero-out-cedar-park-default-rtdb.firebaseio.com"
});

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

exports.deleteExpiredGames = onSchedule(
  {
    schedule: "every 24 hours",
    timeZone: "Etc/UTC",
    region: "us-central1"
  },
  async () => {
    const gamesRef = getDatabase().ref("games");
    const snapshot = await gamesRef.once("value");
    const cutoff = Date.now() - RETENTION_MS;
    const deletions = [];

    snapshot.forEach((gameSnapshot) => {
      const game = gameSnapshot.val();
      const createdAt = Number(game?.createdAt);

      // Preserve records without a valid creation timestamp.
      if (Number.isFinite(createdAt) && createdAt > 0 && createdAt < cutoff) {
        deletions.push(gamesRef.child(gameSnapshot.key).remove());
      }
    });

    await Promise.all(deletions);
    console.log(`Deleted ${deletions.length} game(s) older than seven days.`);
  }
);
