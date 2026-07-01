const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
admin.initializeApp();

exports.getAuthUserCount = onCall(async (request) => {
    // 1. Ensure the user is logged in
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }

    // 2. Security Check: Verify the caller is an Admin in Firestore
    const uid = request.auth.uid;
    const adminDoc = await admin.firestore().collection('admins').doc(uid).get();
    if (!adminDoc.exists) {
        throw new HttpsError('permission-denied', 'Only registered administrators can view the user account count.');
    }

    // 3. Page through all auth accounts and sum them up
    try {
        let totalUsers = 0;
        let nextPageToken;

        do {
            const listUsersResult = await admin.auth().listUsers(1000, nextPageToken);
            totalUsers += listUsersResult.users.length;
            nextPageToken = listUsersResult.pageToken;
        } while (nextPageToken);

        return { count: totalUsers };
    } catch (error) {
        throw new HttpsError('internal', error.message);
    }
});
