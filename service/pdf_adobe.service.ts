import {
  ServicePrincipalCredentials,
  PDFServices,
  MimeType,
  ExportPDFParams,
  ExportPDFTargetFormat,
  ExportPDFJob,
  ExportPDFResult,
  SDKError,
  ServiceUsageError,
  ServiceApiError,
} from "@adobe/pdfservices-node-sdk";
import { Readable } from "stream";
export async function pdfToDocx(fileUrl: string): Promise<Buffer> {
  try {
    const sourceResponse = await fetch(fileUrl);

    if (!sourceResponse.ok || !sourceResponse.body) {
      throw new Error(
        `Failed to fetch source PDF (${sourceResponse.status} ${sourceResponse.statusText})`,
      );
    }

    const readStream = Readable.fromWeb(sourceResponse.body as any);

    const credentials = new ServicePrincipalCredentials({
      clientId: process.env.PDF_SERVICES_CLIENT_ID!,
      clientSecret: process.env.PDF_SERVICES_CLIENT_SECRET!,
    });

    const pdfServices = new PDFServices({ credentials });

    const inputAsset = await pdfServices.upload({
      readStream,
      mimeType: MimeType.PDF,
    });

    const params = new ExportPDFParams({
      targetFormat: ExportPDFTargetFormat.DOCX,
    });

    const job = new ExportPDFJob({ inputAsset, params });

    const pollingURL = await pdfServices.submit({ job });

    const pdfServicesResponse = await pdfServices.getJobResult({
      pollingURL,
      resultType: ExportPDFResult,
    });

    if (!pdfServicesResponse.result) {
      throw new Error("Adobe PDF Services returned no result for export job");
    }

    const resultAsset = pdfServicesResponse.result.asset;
    const streamAsset = await pdfServices.getContent({ asset: resultAsset });

    const chunks: Buffer[] = [];
    for await (const chunk of streamAsset.readStream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  } catch (err) {
    if (err instanceof ServiceUsageError) {
      throw new Error(`Adobe PDF Services quota/usage error: ${err.message}`);
    }
    if (err instanceof ServiceApiError) {
      throw new Error(`Adobe PDF Services API error: ${err.message}`);
    }
    if (err instanceof SDKError) {
      throw new Error(`Adobe PDF Services SDK error: ${err.message}`);
    }
    throw err;
  }
}
