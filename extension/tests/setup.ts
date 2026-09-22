// Polyfills IndexedDB for storage/offerDb.ts + offerRepo.ts tests, since
// jsdom doesn't implement it.
import "fake-indexeddb/auto";
