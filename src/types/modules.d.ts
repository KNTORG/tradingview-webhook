declare module "castv2-client" {
    export class Client {
        connect(options: { host: string; port?: number }, callback: () => void): void;
        launch(
            app: typeof DefaultMediaReceiver,
            callback: (err: Error | null, player: MediaReceiver) => void
        ): void;
        close(): void;
        on(event: string, callback: (err: Error) => void): void;
    }

    interface MediaReceiver {
        load(
            media: { contentId: string; contentType: string; streamType: string },
            options: { autoplay: boolean },
            callback: (err: Error | null) => void
        ): void;
        on(event: string, callback: (status: MediaStatus) => void): void;
    }

    interface MediaStatus {
        idleReason?: string;
        playerState?: string;
    }

    export const DefaultMediaReceiver: typeof MediaReceiver;
}

declare module "google-tts-api" {
    interface TTSOptions {
        lang?: string;
        slow?: boolean;
        host?: string;
    }

    interface AudioResult {
        url: string;
        shortText: string;
    }

    export function getAllAudioUrls(
        text: string,
        options?: TTSOptions
    ): AudioResult[];

    export function getAudioUrl(
        text: string,
        options?: TTSOptions
    ): string;
}
