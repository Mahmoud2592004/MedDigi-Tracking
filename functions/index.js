const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const functions = require('firebase-functions/v1');
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

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { logger } = require('firebase-functions');

exports.resolveUserStatesDaily = onSchedule({
    schedule: '15 2 * * *', // runs daily at 2:15 AM Cairo time
    timeZone: 'Africa/Cairo', // Matches Egypt time zone
    timeoutSeconds: 300, // 5 minutes execution time limit
    memory: '1GiB' // Allocated 1GiB to provide plenty of V8 heap space
}, async (event) => {
    const db = admin.firestore();
    
    // 1. Fetch all users from Firestore, selecting only the necessary fields
    // This is a major memory optimization that ignores heavy fields (arrays/objects) 
    // inside the document, preventing Node.js out-of-memory heap crashes.
    const usersSnapshot = await db.collection('users')
        .select('location', 'state', 'isLocationProcessed')
        .get();
    const unprocessedUsers = [];

    usersSnapshot.forEach(doc => {
        const data = doc.data();
        const state = data.state || '';
        const hasLocationCoords = data.location && (data.location.includes('[') || data.location.includes('('));

        // Need processing if they have coords and haven't been successfully processed
        if (hasLocationCoords && data.isLocationProcessed !== true) {
            unprocessedUsers.push({ id: doc.id, location: data.location, state: state });
        }
    });

    logger.info(`Found ${unprocessedUsers.length} total users needing location resolution.`);

    if (unprocessedUsers.length === 0) {
        logger.info('No unprocessed users found. Exiting.');
        return;
    }

    // Limit to 100 users per run to comfortably stay within 5 minutes timeout (100 * 1.2s = ~2 mins)
    const batchToProcess = unprocessedUsers.slice(0, 100);
    logger.info(`Starting batch processing of ${batchToProcess.length} users...`);

    // 2. Process batch sequentially with a delay to respect Nominatim API rate limit (1 request/sec)
    for (let i = 0; i < batchToProcess.length; i++) {
        const user = batchToProcess[i];
        
        // Extract latitude and longitude from string coords
        const coordsRegex = /[\[\(](-?\d+\.\d+),\s*(-?\d+\.\d+)[\]\)]/;
        const match = user.location.match(coordsRegex);

        if (!match) {
            // No valid coords pattern, mark as processed so we don't scan it again
            await db.collection('users').doc(user.id).update({
                isLocationProcessed: true
            });
            continue;
        }

        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[2]);

        logger.info(`[${i + 1}/${batchToProcess.length}] Resolving state for User ID: ${user.id} (${lat}, ${lng})...`);

        try {
            const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'MedDigi-G-Backend/1.0.0 (mahmoud2592004@gmail.com)'
                }
            });

            if (!response.ok) {
                logger.error(`OSM Request failed for user ${user.id}. Status: ${response.status}`);
                if (response.status === 429) {
                    logger.warn('Rate limit (429) hit. Sleeping 5 seconds...');
                    await new Promise(r => setTimeout(r, 5000));
                }
                continue;
            }

            const data = await response.json();
            const resolvedState = data.address?.state || data.address?.governorate || data.address?.province || null;

            if (resolvedState) {
                logger.info(`Successfully resolved state for ${user.id} to "${resolvedState}"`);
                await db.collection('users').doc(user.id).update({
                    updated_state: resolvedState.trim(),
                    isLocationProcessed: true
                });
            } else {
                logger.warn(`No state found in geocoding results for ${user.id}. Marking processed.`);
                await db.collection('users').doc(user.id).update({
                    isLocationProcessed: true
                });
            }
        } catch (err) {
            logger.error(`Error processing User ID ${user.id}:`, err);
        }

        // Delay 1.2 seconds to satisfy the OpenStreetMap Fair Use policy (max 1 req/sec)
        if (i < batchToProcess.length - 1) {
            await new Promise(r => setTimeout(r, 1200));
        }
    }

    logger.info('Daily state resolution batch completed successfully.');
});

exports.onUserWrite = onDocumentWritten("users/{userId}", async (event) => {
    const db = admin.firestore();
    const userId = event.params.userId;
    const change = event.data;

    let type = 'update';
    if (change.before.exists && !change.after.exists) {
        type = 'delete';
    }

    logger.info(`User ${userId} was ${type}d. Writing sync change log entry.`);

    try {
        await db.collection('sync_changes').add({
            userId: userId,
            type: type,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (err) {
        logger.error(`Failed to write sync change log for user ${userId}:`, err);
    }
});

exports.onAuthUserCreated = functions.auth.user().onCreate(async (user) => {
    const db = admin.firestore();
    logger.info(`Auth user created: ${user.uid}. Logging sync update.`);
    try {
        await db.collection('sync_changes').add({
            userId: user.uid,
            type: 'update',
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (err) {
        logger.error(`Failed to log auth user creation for ${user.uid}:`, err);
    }
});

exports.onAuthUserDeleted = functions.auth.user().onDelete(async (user) => {
    const db = admin.firestore();
    logger.info(`Auth user deleted: ${user.uid}. Deleting Firestore profile and logging deletion.`);
    try {
        // 1. Delete Firestore user profile document
        await db.collection('users').doc(user.uid).delete();

        // 2. Add deletion entry to sync_changes log
        await db.collection('sync_changes').add({
            userId: user.uid,
            type: 'delete',
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (err) {
        logger.error(`Failed to handle auth user deletion for ${user.uid}:`, err);
    }
});


