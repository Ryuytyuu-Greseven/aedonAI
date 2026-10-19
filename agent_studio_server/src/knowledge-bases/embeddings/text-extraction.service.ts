import { BadRequestException, Injectable } from '@nestjs/common';
import axios from 'axios';
import * as mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

const DOCX_MIMETYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const TEXT_MIMETYPES = new Set(['text/plain', 'text/markdown', 'text/csv']);
const TEXT_EXTENSIONS = new Set(['txt', 'md', 'csv']);

@Injectable()
export class TextExtractionService {
  /** Extracts plain text from an uploaded file's in-memory buffer. */
  async extractFromFile(
    buffer: Buffer,
    filename: string,
    mimetype: string,
  ): Promise<string> {
    const extension = filename.split('.').pop()?.toLowerCase();

    if (mimetype === 'application/pdf' || extension === 'pdf') {
      const parser = new PDFParse({ data: buffer });
      try {
        // pdf-parse defaults to injecting a "-- page of total --" marker
        // between pages; suppress it so it doesn't pollute embedded chunks.
        return (await parser.getText({ pageJoiner: '' })).text;
      } finally {
        await parser.destroy();
      }
    }

    if (mimetype === DOCX_MIMETYPE || extension === 'docx') {
      return (await mammoth.extractRawText({ buffer })).value;
    }

    if (
      TEXT_MIMETYPES.has(mimetype) ||
      (extension && TEXT_EXTENSIONS.has(extension))
    ) {
      return buffer.toString('utf-8');
    }

    throw new BadRequestException(
      `Unsupported file type "${mimetype || extension}". Supported types: pdf, docx, txt, md, csv.`,
    );
  }

  /** Fetches a URL and extracts its readable text content. */
  async extractFromUrl(url: string): Promise<string> {
    const { data, headers } = await axios.get<string>(url, {
      responseType: 'text',
      timeout: 15000,
      headers: { Accept: 'text/html,text/plain,*/*' },
    });

    const contentType = String(headers['content-type'] ?? '');
    return contentType.includes('text/html') ? this.stripHtml(data) : data;
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
