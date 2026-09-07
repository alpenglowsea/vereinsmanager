import { Meeting, MeetingType, MeetingAgendaItem, MeetingResolution } from '../types';
import { AiBookingService } from './aiBookingService';

export interface MeetingExtractedData {
  title?: string;
  type?: MeetingType;
  date?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  chairperson?: string;
  minuteKeeper?: string;
  agenda: MeetingAgendaItem[];
  attendees?: Array<{
    name: string;
    role?: string;
    present?: boolean;
    hasVotingRight?: boolean;
  }>;
  generalNotes?: string;
  confidence?: number;
  extractedRawSummary?: string;
  transcriptSummary?: string;
}

export class MeetingAiService {
  /**
   * Helper to convert a File or Blob into a Base64 data URL
   */
  static fileToDataUrl(file: File | Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }

  /**
   * Analyzes uploaded meeting notes (PDF, PNG, JPG, JPEG, WEBP)
   * Converts handwritten notes, flipchart photos, or drafted minutes into a structured meeting protocol.
   */
  static async analyzeNotes(
    fileOrDataUrl: File | string,
    fileName?: string,
    meetingContext?: { title?: string; type?: MeetingType; date?: string }
  ): Promise<MeetingExtractedData> {
    let fileDataUrl: string;
    let actualFileName = fileName || 'Notizen';

    if (typeof fileOrDataUrl === 'string') {
      fileDataUrl = fileOrDataUrl;
    } else {
      fileDataUrl = await this.fileToDataUrl(fileOrDataUrl);
      actualFileName = fileOrDataUrl.name;
    }

    const userApiKey = AiBookingService.getStoredApiKey();

    const response = await fetch('/api/meetings/analyze-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileDataUrl,
        fileName: actualFileName,
        meetingContext,
        userApiKey: userApiKey || undefined,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Fehler bei der Notizen-Analyse (${response.status})`);
    }

    const json = await response.json();
    if (!json.success || !json.data) {
      throw new Error(json.error || 'Ungültige Antwort vom Server erhalten.');
    }

    return this.normalizeExtractedData(json.data);
  }

  /**
   * Analyzes an audio recording of a meeting (Vorstandssitzung, Ausschuss, etc.).
   * Strictly blocked for general_assembly (Mitgliederversammlung).
   */
  static async analyzeAudio(
    audioOrDataUrl: Blob | string,
    fileName?: string,
    meetingContext?: { title?: string; type?: MeetingType; date?: string }
  ): Promise<MeetingExtractedData> {
    // Client-side guard for privacy compliance
    if (meetingContext?.type === 'general_assembly' || meetingContext?.type === 'extraordinary_assembly') {
      throw new Error(
        'Audio-Erfassung ist für Mitgliederversammlungen aus Datenschutzgründen (DSGVO § 201 StGB) und wegen der Stimmenvielfalt nicht zulässig. Bitte nutzen Sie Textnotizen oder den Dokumenten-Upload.'
      );
    }

    let audioDataUrl: string;
    let actualFileName = fileName || 'Aufnahme.webm';

    if (typeof audioOrDataUrl === 'string') {
      audioDataUrl = audioOrDataUrl;
    } else {
      audioDataUrl = await this.fileToDataUrl(audioOrDataUrl);
      if ('name' in audioOrDataUrl) {
        actualFileName = (audioOrDataUrl as any).name;
      }
    }

    const userApiKey = AiBookingService.getStoredApiKey();

    const response = await fetch('/api/meetings/analyze-audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audioDataUrl,
        fileName: actualFileName,
        meetingContext,
        userApiKey: userApiKey || undefined,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Fehler bei der Audio-Auswertung (${response.status})`);
    }

    const json = await response.json();
    if (!json.success || !json.data) {
      throw new Error(json.error || 'Ungültige Antwort vom Server erhalten.');
    }

    return this.normalizeExtractedData(json.data);
  }

  /**
   * AI drafting assistant for resolutions, notes polishing, and agenda generation
   */
  static async assistDraft<T = any>(
    action: 'formulate_resolution' | 'polish_discussion' | 'suggest_agenda',
    input: string,
    context?: any
  ): Promise<T> {
    const userApiKey = AiBookingService.getStoredApiKey();

    const response = await fetch('/api/meetings/ai-assist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        input,
        context,
        userApiKey: userApiKey || undefined,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Fehler bei der KI-Entwurfshilfe (${response.status})`);
    }

    const json = await response.json();
    if (!json.success) {
      throw new Error(json.error || 'Fehler beim Abrufen der KI-Entwurfshilfe.');
    }

    return json.data as T;
  }

  /**
   * Normalizes incoming raw extracted data to match MeetingAgendaItem / MeetingResolution types with safe IDs
   */
  private static normalizeExtractedData(data: any): MeetingExtractedData {
    const agenda: MeetingAgendaItem[] = (data.agenda || []).map((item: any, topIndex: number) => {
      const topId = `top-${Date.now()}-${topIndex + 1}`;
      const resolutions: MeetingResolution[] = (item.resolutions || []).map((res: any, resIndex: number) => {
        return {
          id: `res-${Date.now()}-${topIndex + 1}-${resIndex + 1}`,
          agendaItemNumber: item.number || `TOP ${topIndex + 1}`,
          title: res.title || 'Beschluss',
          motionText: res.motionText || res.title || '',
          proposer: res.proposer || '',
          votesFor: typeof res.votesFor === 'number' ? res.votesFor : 0,
          votesAgainst: typeof res.votesAgainst === 'number' ? res.votesAgainst : 0,
          votesAbstain: typeof res.votesAbstain === 'number' ? res.votesAbstain : 0,
          result: res.result === 'rejected' ? 'rejected' : res.result === 'deferred' ? 'deferred' : 'accepted',
          isTaxRelevant: Boolean(res.isTaxRelevant),
          isRegisterRelevant: Boolean(res.isRegisterRelevant),
          responsiblePerson: res.responsiblePerson || '',
          dueDate: res.dueDate || '',
          notes: res.notes || '',
        };
      });

      return {
        id: topId,
        number: item.number || `TOP ${topIndex + 1}`,
        title: item.title || `Tagesordnungspunkt ${topIndex + 1}`,
        speaker: item.speaker || '',
        discussionNotes: item.discussionNotes || '',
        resolutions,
      };
    });

    return {
      title: data.title,
      type: data.type,
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      location: data.location,
      chairperson: data.chairperson,
      minuteKeeper: data.minuteKeeper,
      agenda,
      attendees: data.attendees || [],
      generalNotes: data.generalNotes,
      confidence: data.confidence,
      extractedRawSummary: data.extractedRawSummary,
      transcriptSummary: data.transcriptSummary,
    };
  }
}
