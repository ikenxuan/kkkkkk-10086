import crypto from 'crypto';
const publicKey = await crypto.subtle.importKey('jwk', {
    kty: 'RSA',
    n: 'y4HdjgJHBlbaBN04VERG4qNBIFHP6a3GozCl75AihQloSWCXC5HDNgyinEnhaQ_4-gaMud_GF50elYXLlCToR9se9Z8z433U3KjM-3Yx7ptKkmQNAMggQwAVKgq3zYAoidNEWuxpkY_mAitTSRLnsJW-NCTa0bqBFF6Wm1MxgfE',
    e: 'AQAB'
}, { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['encrypt']);
export default async function getCorrespondPath(timestamp) {
    const data = new TextEncoder().encode(`refresh_${timestamp}`);
    const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, data));
    return encrypted.reduce((str, c) => str + c.toString(16).padStart(2, '0'), '');
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQ29ycmVzcG9uZFBhdGguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvYnVzaW5lc3MvYmlsaWJpbGkvc2lnbi9Db3JyZXNwb25kUGF0aC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUE7QUFFM0IsTUFBTSxTQUFTLEdBQUcsTUFBTSxNQUFNLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FDN0MsS0FBSyxFQUNMO0lBQ0UsR0FBRyxFQUFFLEtBQUs7SUFDVixDQUFDLEVBQUUsNktBQTZLO0lBQ2hMLENBQUMsRUFBRSxNQUFNO0NBQ1YsRUFDRCxFQUFFLElBQUksRUFBRSxVQUFVLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxFQUNyQyxJQUFJLEVBQ0osQ0FBRSxTQUFTLENBQUUsQ0FDZCxDQUFBO0FBRUQsTUFBTSxDQUFDLE9BQU8sQ0FBQyxLQUFLLFVBQVUsaUJBQWlCLENBQUUsU0FBaUI7SUFDaEUsTUFBTSxJQUFJLEdBQUcsSUFBSSxXQUFXLEVBQUUsQ0FBQyxNQUFNLENBQUMsV0FBVyxTQUFTLEVBQUUsQ0FBQyxDQUFBO0lBQzdELE1BQU0sU0FBUyxHQUFHLElBQUksVUFBVSxDQUFDLE1BQU0sTUFBTSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLEVBQUUsU0FBUyxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUE7SUFDcEcsT0FBTyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQTtBQUNoRixDQUFDIn0=