/** Shared between the worker (chunking audio for transcription) and the
 *  view (mapping segment progress back onto waveform pixel ranges). */
export const SEGMENT_SECONDS = 20
export const SAMPLE_RATE = 16000

/** Live (during-recording) transcription cadence, in seconds. Starts fast and
 *  backs off toward SEGMENT_SECONDS if a device can't keep up in real time. */
export const LIVE_START_INTERVAL_S = 4
export const LIVE_MAX_INTERVAL_S = SEGMENT_SECONDS

/** @huggingface/transformers' default Cache Storage bucket name for downloaded
 *  model files (its `env.cacheKey`). Duplicated here (rather than importing the
 *  library into the main bundle) so the main thread can list/delete cached
 *  models without pulling transformers.js out of the worker-only chunk. */
export const TRANSFORMERS_CACHE_NAME = 'transformers-cache'
