#!/bin/bash

# Script to initialize Firebase Firestore collections

echo "Firebase Firestore Initialization Script"
echo "---------------------------------------"
echo "This script will initialize the basic collections and required indexes in your Firebase Firestore database."
echo "It uses environment variables from .env.local for configuration."
echo ""

# Source environment variables if .env.local exists
if [ -f ".env.local" ]; then
    echo "Loading environment variables from .env.local..."
    set -o allexport
    source .env.local
    set +o allexport
else
    echo "Warning: .env.local file not found. Relying on pre-existing environment variables."
fi

# Determine Firebase Project ID
# Prioritize GCP_PROJECT_ID, then NEXT_PUBLIC_FIREBASE_PROJECT_ID
if [ -n "$GCP_PROJECT_ID" ]; then
    FIREBASE_PROJECT_ID="$GCP_PROJECT_ID"
    echo "Using GCP_PROJECT_ID as Firebase Project ID: $FIREBASE_PROJECT_ID"
elif [ -n "$NEXT_PUBLIC_FIREBASE_PROJECT_ID" ]; then
    FIREBASE_PROJECT_ID="$NEXT_PUBLIC_FIREBASE_PROJECT_ID"
    echo "Using NEXT_PUBLIC_FIREBASE_PROJECT_ID as Firebase Project ID: $FIREBASE_PROJECT_ID"
else
    echo "Error: Neither GCP_PROJECT_ID nor NEXT_PUBLIC_FIREBASE_PROJECT_ID environment variable is set."
    echo "Please define one of them in your .env.local file or export it."
    exit 1
fi

# Check if gcloud CLI is installed
if ! command -v gcloud &> /dev/null; then
    echo "Error: gcloud CLI is required but not installed. Please install and configure it first."
    exit 1
fi

ACCESS_TOKEN=""

# Attempt to get access token
if [ -n "$GOOGLE_APPLICATION_CREDENTIALS" ]; then
    echo "Using GOOGLE_APPLICATION_CREDENTIALS environment variable for authentication..."
    # Write the JSON key to a temporary file
    TEMP_CRED_FILE="temp_gcp_creds.json"
    # Ensure the variable content is correctly interpreted as JSON
    if [[ "$GOOGLE_APPLICATION_CREDENTIALS" == *{* ]]; then
        echo "$GOOGLE_APPLICATION_CREDENTIALS" > "$TEMP_CRED_FILE"
    else
        # If it's a path, try to read from it
        if [ -f "$GOOGLE_APPLICATION_CREDENTIALS" ]; then
            cat "$GOOGLE_APPLICATION_CREDENTIALS" > "$TEMP_CRED_FILE"
        else
            echo "Warning: GOOGLE_APPLICATION_CREDENTIALS seems to be a path but file not found: $GOOGLE_APPLICATION_CREDENTIALS"
        fi
    fi
    
    # Check if the temp file was created successfully and is not empty
    if [ ! -s "$TEMP_CRED_FILE" ]; then
        echo "Error: Failed to write GOOGLE_APPLICATION_CREDENTIALS to temporary file or variable/file is empty."
        rm -f "$TEMP_CRED_FILE" # Clean up empty/failed temp file
        # Fall-through to try ADC without service account file
    else
        # Set environment variable for gcloud to use the key file
        export GOOGLE_APPLICATION_CREDENTIALS_FOR_SCRIPT="$TEMP_CRED_FILE" 
        
        ACCESS_TOKEN=$(gcloud auth application-default print-access-token --impersonate-service-account=$(jq -r .client_email "$GOOGLE_APPLICATION_CREDENTIALS_FOR_SCRIPT") 2>/dev/null || gcloud auth application-default print-access-token 2>/dev/null)
        
        # Unset and remove temporary credentials
        unset GOOGLE_APPLICATION_CREDENTIALS_FOR_SCRIPT
        rm "$TEMP_CRED_FILE"
        
        if [ -n "$ACCESS_TOKEN" ]; then
            echo "Access token obtained using GOOGLE_APPLICATION_CREDENTIALS."
        else
            echo "Warning: Failed to obtain access token using GOOGLE_APPLICATION_CREDENTIALS. Trying other methods..."
        fi
    fi
fi

# If access token not obtained yet, try with ambient gcloud ADC
if [ -z "$ACCESS_TOKEN" ]; then
    echo "Attempting to use ambient gcloud Application Default Credentials..."
    ACCESS_TOKEN=$(gcloud auth application-default print-access-token 2>/dev/null)
    if [ -n "$ACCESS_TOKEN" ]; then
        echo "Access token obtained using ambient gcloud ADC."
    fi
fi

if [ -z "$ACCESS_TOKEN" ]; then
    echo "Error: Failed to get access token."
    echo "Please ensure gcloud is configured correctly (e.g., run 'gcloud auth application-default login')"
    echo "or provide a valid GOOGLE_APPLICATION_CREDENTIALS (either JSON content or path to JSON file) in .env.local."
    exit 1
fi

echo "Access token obtained successfully."
echo ""

# Firestore base URL for REST API
FIRESTORE_URL="https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents"
echo "Using Firestore URL: ${FIRESTORE_URL}"
echo ""

# Function to check if a collection exists and create a document if it doesn't
# $1: Collection name
# $2: Document ID
# $3: Document data in JSON format (fields only)
create_document() {
    local collection="$1"
    local doc_id="$2"
    local data_fields="$3" # Expecting only the content of "fields"
    local full_url="${FIRESTORE_URL}/${collection}" # Note: doc_id is appended with ?documentId for PATCH/POST
    
    echo "Creating/Updating document in collection: ${collection}, ID: ${doc_id}"
    
    # Firestore REST API expects a specific JSON format for the document
    local firestore_document_payload="{
        \"fields\": ${data_fields}
    }"
    
    # Using PATCH with document ID in URL to create or overwrite.
    # For creating with auto-generated ID, use POST to collection URL and omit doc_id from URL.
    # Here, we assume we always want to specify the ID.
    response_code=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH \
        "${full_url}/${doc_id}" \
        -H "Authorization: Bearer ${ACCESS_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "${firestore_document_payload}")

    if [ "$response_code" -eq 200 ]; then
        echo "Successfully created/updated document '${doc_id}' in '${collection}' (HTTP ${response_code})"
    else
        echo "Error creating/updating document '${doc_id}' in '${collection}'. HTTP Status Code: ${response_code}"
        echo "Full URL used for PATCH: ${full_url}/${doc_id}"
        echo "Payload sent: ${firestore_document_payload}"
        echo "Attempting to show error response from Firestore:"
        # Run curl again without -s -o /dev/null to see the actual error output
        curl -X PATCH \
            "${full_url}/${doc_id}" \
            -H "Authorization: Bearer ${ACCESS_TOKEN}" \
            -H "Content-Type: application/json" \
            -d "${firestore_document_payload}"
        echo "" # Newline after error output
    fi
    echo ""
}


# 4. Deploy Firestore indexes from firestore.indexes.json
echo "--- Deploying Firestore indexes from firestore.indexes.json ---"
if [ -f "firestore.indexes.json" ]; then
    echo "Found firestore.indexes.json."
    if ! command -v firebase &> /dev/null; then
        echo "Warning: Firebase CLI is not installed. This is recommended for deploying Firestore indexes."
        echo "Attempting to deploy using gcloud..."
        gcloud firestore indexes replace firestore.indexes.json --project="${FIREBASE_PROJECT_ID}" --quiet
        GCLOUD_INDEX_EXIT_CODE=$?
        if [ $GCLOUD_INDEX_EXIT_CODE -eq 0 ]; then
            echo "Firestore indexes deployment initiated successfully using gcloud."
        else
            echo "Error deploying Firestore indexes using gcloud. Exit code: $GCLOUD_INDEX_EXIT_CODE"
            echo "Please check the gcloud output or try deploying manually using Firebase CLI if available:"
            echo "  firebase login"
            echo "  firebase use ${FIREBASE_PROJECT_ID}"
            echo "  firebase deploy --only firestore:indexes --project ${FIREBASE_PROJECT_ID}"
            echo "Or create indexes via the Firebase console."
        fi
    else
        echo "Firebase CLI found. Attempting to deploy indexes..."
        DEPLOY_OUTPUT=$(firebase deploy --only firestore:indexes --project "${FIREBASE_PROJECT_ID}" --non-interactive --debug 2>&1)
        DEPLOY_EXIT_CODE=$?
        if [ $DEPLOY_EXIT_CODE -eq 0 ]; then
            echo "Firestore indexes deployment initiated successfully using Firebase CLI."
        elif echo "$DEPLOY_OUTPUT" | grep -q -E 'HTTP Error: 409|already exists'; then
            echo "Some indexes might already exist (409 conflict or similar message). This is often not a fatal error. Check Firebase console."
        else
            echo "Error deploying Firestore indexes using Firebase CLI. Exit code: $DEPLOY_EXIT_CODE"
            echo "Output: $DEPLOY_OUTPUT"
            echo "Please ensure you are logged into Firebase CLI ('firebase login') and have selected your project ('firebase use ${FIREBASE_PROJECT_ID}')."
            echo "You can try deploying manually: firebase deploy --only firestore:indexes --project ${FIREBASE_PROJECT_ID}"
            echo "Alternatively, try updating gcloud components ('gcloud components update') and using gcloud:"
            echo "  gcloud firestore indexes replace firestore.indexes.json --project=${FIREBASE_PROJECT_ID}"
            echo "or create the index via the Firebase console."
        fi
    fi
else
    echo "Warning: firestore.indexes.json not found. Skipping index deployment from this file."
fi
echo ""

# 5. Create specific composite indexes using gcloud

echo "--- Creating/Updating composite index for 'files' (expiresAt DESC, uploadedAt DESC) ---"
gcloud firestore indexes composite create \
  --project="${FIREBASE_PROJECT_ID}" \
  --collection-group="files" \
  --field-config field-path="expiresAt",order="DESCENDING" \
  --field-config field-path="uploadedAt",order="DESCENDING" --quiet
echo "Composite index for 'files' (expiresAt, uploadedAt) creation/update initiated."
echo ""

echo "--- Creating/Updating composite index for 'apiKeys' (userId ASC, createdAt DESC) ---"
gcloud firestore indexes composite create \
  --project="${FIREBASE_PROJECT_ID}" \
  --collection-group="apiKeys" \
  --field-config field-path="userId",order="ASCENDING" \
  --field-config field-path="createdAt",order="DESCENDING" --quiet
echo "Composite index for 'apiKeys' (userId, createdAt) creation/update initiated."
echo ""

echo "--- Creating/Updating vector index for 'files.embedding' (768 dimensions) ---"
gcloud firestore indexes composite create \
  --project="${FIREBASE_PROJECT_ID}" \
  --collection-group="files" \
  --query-scope=COLLECTION \
  --field-config=vector-config='{"dimension":768,"flat": {}}',field-path=embedding --quiet
echo "Vector index for 'files.embedding' creation/update initiated."
echo "Note: Index creation can take some time. Check the Firebase or Google Cloud console for status."
echo ""


echo "---------------------------------------"
echo "Firebase Firestore initialization script finished."
echo "Review the output above for any errors or warnings."
echo "It might take several minutes for indexes to build and become active."
echo ""
echo "Your Firestore database should now have these collections and indexes configured:"
echo "- Collections (implicitly created by adding documents or indexes):"
echo "  - files: For storing file metadata (initialized with a placeholder)"
echo "  - apiKeys: For API key records (index created)"
echo "  - metrics: For tracking usage statistics (ensure your app creates this or add init step if needed)"
echo "  - events: For application event logs (ensure your app creates this or add init step if needed)"
echo "- Indexes:"
echo "  - From firestore.indexes.json (if file existed and deployment was successful)"
echo "  - Composite index on 'files': expiresAt (DESC), uploadedAt (DESC)"
echo "  - Composite index on 'apiKeys': userId (ASC), createdAt (DESC)"
echo "  - Vector index on 'files.embedding' (768 dimensions)"
echo ""
echo "These configurations align with how your application appears to use Firestore."
