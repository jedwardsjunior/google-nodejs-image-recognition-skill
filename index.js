'use strict';

/**
 * @author - jedwards
 * @date - September 2017
 */

// Load the required NPM modules
const BoxSDK = require('box-node-sdk');
const ColorNamer = require('color-namer')
const GoogleCloudVision = require('@google-cloud/vision');
const Unescape = require('unescape-js');

// An array of all the features we're requesting Google Cloud Vision to return
const features = [
	{
		type: GoogleCloudVision.v1.types.Feature.Type.LANDMARK_DETECTION
	},
	{
		type: GoogleCloudVision.v1.types.Feature.Type.LOGO_DETECTION
	},
	{
		type: GoogleCloudVision.v1.types.Feature.Type.LABEL_DETECTION
	},
	{
		type: GoogleCloudVision.v1.types.Feature.Type.TEXT_DETECTION
	},
	{
		type: GoogleCloudVision.v1.types.Feature.Type.DOCUMENT_TEXT_DETECTION
	},
	{
		type: GoogleCloudVision.v1.types.Feature.Type.IMAGE_PROPERTIES
	},
	// {
	// 	type: GoogleCloudVision.v1.types.Feature.Type.FACE_DETECTION
	// },
	// {
	// 	type: GoogleCloudVision.v1.types.Feature.Type.CROP_HINTS
	// },
	// {
	// 	type: GoogleCloudVision.v1.types.Feature.Type.SAFE_SEARCH_DETECTION
	// },
	// {
	// 	type: GoogleCloudVision.v1.types.Feature.Type.WEB_DETECTION
	// },
]

// Arrays for each of the types of annotations that Google Cloud Vision returns.
// Each array contains the features that return the corresponding type.
// See: https://googlecloudplatform.github.io/google-cloud-node/#/docs/vision/0.12.0/vision/v1/data_types?method=AnnotateImageResponse
const entityAnnotationTypes = ['landmarkAnnotations', 'logoAnnotations', 'labelAnnotations', 'textAnnotations'];
const fullTextAnnotationTypes = ['fullTextAnnotation'];
const imagePropertiesAnnotationTypes = ['imagePropertiesAnnotation'];
const faceAnnotationTypes = ['faceAnnotations'];
const cropHintsAnnotationTypes = ['cropHintsAnnotation'];
const safeSearchAnnotationTypes = ['safeSearchAnnotation'];
const webDetectionTypes = ['webDetection'];

// Set up access to the Google Cloud Vision API
const google_cloud_vision = new GoogleCloudVision({
	projectId: process.env.GCV_PROJECT_ID,
	credentials: {
		client_email: process.env.GCV_CLIENT_EMAIL,
		private_key: Unescape(process.env.GCV_PRIVATE_KEY)
	}
});

/**
 * exports.handler()
 *
 * This is the main function that the Lamba will call when invoked.
 *
 * Inputs:
 * (JSON) event - data from the event, including the payload of the webhook, that triggered this function call
 * (JSON) context - additional context information from the request (unused in this example)
 * (function) callback - the function to call back to once finished
 *
 * Outputs:
 * (void)
 */
exports.handler = (event, context, callback) => {
	var sdk = new BoxSDK({
		clientID: process.env.BOX_CLIENT_ID,
		clientSecret: process.env.BOX_CLIENT_SECRET,
		appAuth: {
			keyID: process.env.BOX_KEY_ID,
			privateKey: Unescape(process.env.BOX_PRIVATE_KEY),
			passphrase: process.env.BOX_PASSPHRASE
		},
	});

	var webhookData = JSON.parse(event.body);
	var userID = webhookData.source.created_by.id;
	var fileID = webhookData.source.id;

	var client = sdk.getAppAuthClient('user', userID);
	getAnnotations(client, fileID, (error, annotations) => {
    	var metadataValue = getMetadataValue(annotations);
    	saveMetadata(client, fileID, metadataValue, callback);
    });
};

/**
 * getAnnotations()
 *
 * Helper function to pass the contents of the image file to the Google Cloud Vision API to grab the annotations that
 * can be found on the image.
 *
 * Inputs:
 * (Object) client - the Box API client that we will use to read in the file contents
 * (int) fileID - the ID of the image file to classify
 * (function) callback - the function to call back to once finished
 *
 * Output:
 * (void)
 */
const getAnnotations = (client, fileID, callback) => {
	client.files.getReadStream(fileID, null, (error, stream) => {
		
		if (error) {
			console.log(error);
			callback(error);
		}

		var buffer = new Buffer('', 'base64');
	    stream.on('data', (chunk) => {
	        buffer = Buffer.concat([buffer, chunk]);
	    });

	    stream.on('end', () => {
			var request = {
				image: { content : buffer },
				features: features
			};

			google_cloud_vision.annotateImage(request)
			.then(function(responses) {
				var response = responses[0];
				callback(null, response);
			})
			.catch(function(err) {
				console.log(err);
			});
		});
	});
}

/**
 * saveMetadata()
 *
 * Helper function to save the metadata back to the file on Box.
 *
 * Inputs:
 * (Object) client - the Box API client that we will use to read in the file contents
 * (int) fileID - the ID of the image file to classify
 * (string) metadataValue - the formatted metadata to save back to Box
 * (function) callback - the function to call back to once finished
 *
 * Output:
 * (void)
 */
const saveMetadata = (client, fileID, metadataValue, callback) => {
	var metadata = {
		keywords: metadataValue
	}

	client.files.addMetadata(fileID, client.metadata.scopes.GLOBAL, 'imageContent', metadata, (err, result) => {
		if (err) {
			console.log(err);
			callback(err);
		} else {
			var response = {
	        	statusCode: 200,
	        	body: metadata
	    	}

			console.log('Success: ' + response);
	    	callback(null, response);
		}
	})
}

/**
 * getMetadataValue()
 *
 * Helper function to format all the annotations found by the Cloud Vision API into metadata that we will save back
 * to Box.
 *
 * Input:
 * (Object) annotations - the annotations found by the Cloud Vision API
 *
 * Output:
 * (string) - the formatted metadata to save back to Box
 */
const getMetadataValue = (annotations) => {
	var annotationImageResponse = JSON.parse(JSON.stringify(annotations));
	console.log(annotationImageResponse);
	var metadataValue = '';
	metadataValue = getMetadataValueForEntityAnnotations(annotationImageResponse, metadataValue);
	metadataValue = getMetadataValueForFullTextAnnotations(annotationImageResponse, metadataValue);
	metadataValue = getMetadataValueForImagePropertiesAnnotations(annotationImageResponse, metadataValue);
	return metadataValue;
}

/**
 * getMetadataValueForEntityAnnotations()
 *
 * Helper function to format the entity annotations (landmarks, labels, text, and logos) found by the Google Cloud Vision API
 *
 * Input:
 * (JSON) annotationImageResponse - the classifications found by the Cloud Vision API in JSON format
 * (string) metadataValue - the string of metadata to concatenate the entity annotations metadata to
 *
 * Output:
 * (string) - the formatted metadata for entity annotations
 */
const getMetadataValueForEntityAnnotations = (annotationImageResponse, metadataValue) => {
	for (var i = 0; i < entityAnnotationTypes.length; i++) {
		var entityAnnotationType = entityAnnotationTypes[i];
		if (annotationImageResponse.hasOwnProperty(entityAnnotationType)) {
			var annotation = annotationImageResponse[entityAnnotationType];
			if (annotation.length > 0) {
				metadataValue += entityAnnotationType + ': ';
				for (var j = 0; j < annotation.length - 1; j++) {
					metadataValue += annotation[j].description
					metadataValue += ', ';
				}
				metadataValue += annotation[j].description + '\n\n';
			}
		}
	}

	return metadataValue;
}

/**
 * getMetadataValueForFullTextAnnotations()
 *
 * Helper function to format the full text annotations found by the Google Cloud Vision API
 *
 * Input:
 * (JSON) annotationImageResponse - the classifications found by the Cloud Vision API in JSON format
 * (string) metadataValue - the string of metadata to concatenate the full text annotations metadata to
 *
 * Output:
 * (string) - the formatted metadata for full text annotations
 */
const getMetadataValueForFullTextAnnotations = (annotationImageResponse, metadataValue) => {
	for (var i = 0; i < fullTextAnnotationTypes.length; i++) {
		var fullTextAnnotationType = fullTextAnnotationTypes[i];
		if (annotationImageResponse.hasOwnProperty(fullTextAnnotationType)) {
			var annotation = annotationImageResponse[fullTextAnnotationType];
			if (annotation && annotation.hasOwnProperty('text')) {
				metadataValue += fullTextAnnotationType + ': ';
				metadataValue += annotation.text + '\n\n';
			}
		}
	}

	return metadataValue;
}

/**
 * getMetadataValueForImagePropertiesAnnotations()
 *
 * Helper function to format the image properties annotations found by the Google Cloud Vision API
 *
 * Input:
 * (JSON) annotationImageResponse - the classifications found by the Cloud Vision API in JSON format
 * (string) metadataValue - the string of metadata to concatenate the image properties annotations metadata to
 *
 * Output:
 * (string) - the formatted metadata for image properties annotations
 */
const getMetadataValueForImagePropertiesAnnotations = (annotationImageResponse, metadataValue) => {
	for (var i = 0; i < imagePropertiesAnnotationTypes.length; i++) {
		var imagePropertiesAnnotationType = imagePropertiesAnnotationTypes[i];
		if (annotationImageResponse.hasOwnProperty(imagePropertiesAnnotationType)) {
			var annotation = annotationImageResponse[imagePropertiesAnnotationType];
			if (annotation && annotation.hasOwnProperty('dominantColors')) {
				metadataValue += imagePropertiesAnnotationType + ': ';
				var dominantColors = annotation.dominantColors.colors;
				for (var c = 0; c < dominantColors.length; c++) {
					var colors = dominantColors[c].color;
					var primaryColors = ColorNamer('rgb(' + colors.red + ',' + colors.green + ',' + colors.blue +')');
					metadataValue += primaryColors.roygbiv[0].name + ' (' + dominantColors[c].score + ')';
					metadataValue += ', ';
				}

				metadataValue = metadataValue.slice(0, -2) + '\n\n';
			}
		}
	}

	return metadataValue;
}

/**
 * getMetadataValueForFaceAnnotations()
 *
 * Helper function to format the face annotations found by the Google Cloud Vision API
 *
 * Input:
 * (JSON) annotationImageResponse - the classifications found by the Cloud Vision API in JSON format
 * (string) metadataValue - the string of metadata to concatenate the face annotations metadata to
 *
 * Output:
 * (string) - the formatted metadata for face annotations
 */
const getMetadataValueForFaceAnnotations = (annotationImageResponse, metadataValue) => {
	for (var i = 0; i < faceAnnotationTypes.length; i++) {
		var faceAnnotationType = faceAnnotationTypes[i];
		if (annotationImageResponse.hasOwnProperty(faceAnnotationType)) {
			var annotation = annotationImageResponse[faceAnnotationType];
			if (annotation) {
				metadataValue += faceAnnotationType + ': ';
				// TODO(jedwards) - format face annotation information into metadata here
				// See: https://googlecloudplatform.github.io/google-cloud-node/#/docs/vision/0.12.0/vision/v1/data_types?method=FaceAnnotation
				metadataValue += annotation[j].description + '\n\n';
			}
		}
	}

	return metadataValue;
}
