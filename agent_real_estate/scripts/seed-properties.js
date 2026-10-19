"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const google_embeddings_js_1 = require("../src/agent/llms/google.embeddings.js");
const property_store_js_1 = require("../src/agent/graphs/sales/tool/property.store.js");
function buildEmbeddingText(property) {
    const amenities = (property.amenities ?? []).map(a => `${a.name}: ${a.description}`).join('. ');
    const nearby = (property.nearbyFacilities ?? []).map(f => `${f.name} (${f.category}, ${f.distance})`).join('. ');
    return [
        `${property.name}, a ${property.type} in ${property.location}.`,
        property.fullDescription,
        property.highlights.join(', '),
        amenities && `Amenities: ${amenities}.`,
        nearby && `Nearby: ${nearby}.`,
    ].filter(Boolean).join(' ');
}
async function main() {
    const filePath = path.join(process.cwd(), 'src', 'config', 'properties.json');
    const raw = await fs.readFile(filePath, 'utf-8');
    const properties = JSON.parse(raw);
    for (const property of properties) {
        const embeddingText = buildEmbeddingText(property);
        const embedding = await google_embeddings_js_1.embeddingsInstance.embedQuery(embeddingText);
        await (0, property_store_js_1.upsertProperty)({ ...property, embedding });
        console.log(`Seeded ${property.id} — ${property.name} (${embedding.length}-dim embedding)`);
    }
    await (0, property_store_js_1.closePropertyStoreConnection)();
    console.log(`Done. Seeded ${properties.length} properties.`);
}
main().catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
});
//# sourceMappingURL=seed-properties.js.map