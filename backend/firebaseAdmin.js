const fs = require('fs')
const path = require('path')

const {
    initializeApp,
    cert
} = require('firebase-admin/app')

const {
    getFirestore
} = require('firebase-admin/firestore')

let firebaseCredential

const serviceAccountPath =
    path.join(
        __dirname,
        'serviceAccountKey.json'
    )

// Online deployment
if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
) {
    firebaseCredential = cert({
        projectId:
            process.env.FIREBASE_PROJECT_ID,

        clientEmail:
            process.env.FIREBASE_CLIENT_EMAIL,

        privateKey:
            process.env.FIREBASE_PRIVATE_KEY
                .replace(/\\n/g, '\n')
    })
}

// Local development
else if (
    fs.existsSync(serviceAccountPath)
) {
    const serviceAccount =
        require(serviceAccountPath)

    firebaseCredential =
        cert(serviceAccount)
}

else {
    throw new Error(
        'Firebase Admin credentials are missing.'
    )
}

initializeApp({
    credential: firebaseCredential
})

const db = getFirestore()

module.exports = db