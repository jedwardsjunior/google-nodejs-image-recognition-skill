'use strict';

/**
 * @author - jedwards
 * @date - September 2017
 */

const skillsData = {
	'skills_data': [{
		'type': 'skills_data',
		'skills_data_type': '',
		'skill': {},
		'invocation': {},
		'title': '',
		'entries': []
	}]
}


/**
 * exports.getMetadataValueForEntityAnnotations()
 *
 * Helper function to format the entity (label and logo) annotations found by the Google Cloud Vision API
 *
 * Input:
 * (JSON) annotationImageResponse - the classifications found by the Cloud Vision API in JSON format
 *
 * Output:
 * (JSON) - the formatted metadata for the entity (label and logo) annotations
 */
exports.getMetadataValueForEntityAnnotations = (annotationImageResponse) => {
	var entries = []
	var entry =  {};
	var annotation = '';
	var i = 0;

	if (annotationImageResponse.hasOwnProperty('logoAnnotations')) {
		annotation = annotationImageResponse['logoAnnotations'];
		if (annotation.length > 0) {
			for (i = 0; i < annotation.length; i++) {
				entry = {
					'text': annotation[i].description
				};
				entries.push(entry);
			}
		}
	}

	if (annotationImageResponse.hasOwnProperty('labelAnnotations')) {
		annotation = annotationImageResponse['labelAnnotations'];
		if (annotation.length > 0) {
			for (i = 0; i < annotation.length; i++) {
				entry = {
					'text': annotation[i].description
				};
				entries.push(entry);
			}
		}
	}

	var metadata = skillsData;
	metadata['skills_data_type'] = 'keyword';
	metadata['title'] = 'Topics';
	metadata['entries'] = entries;
	metadata = {
		keywords: JSON.stringify(metadata)
	};
	return metadata;
}

/**
 * exports.getMetadataValueForFullTextAnnotations()
 *
 * Helper function to format the full text annotations found by the Google Cloud Vision API
 *
 * Input:
 * (JSON) annotationImageResponse - the classifications found by the Cloud Vision API in JSON format
 *
 * Output:
 * (JSON) - the formatted metadata for full text annotations
 */
exports.getMetadataValueForFullTextAnnotations = (annotationImageResponse) => {
	var entries = []
	var entry =  {};

	if (annotationImageResponse.hasOwnProperty('fullTextAnnotation')) {
		var annotation = annotationImageResponse['fullTextAnnotation'];
		if (annotation && annotation.hasOwnProperty('text')) {
			entry = {
				'text': annotation.text
			};
			entries.push(entry);
		}
	}

	var metadata = skillsData;
	metadata['skills_data_type'] = 'transcript';
	metadata['title'] = 'OCR';
	metadata['entries'] = entries;
	metadata = {
		transcripts: JSON.stringify(metadata)
	};
	return metadata;
}
