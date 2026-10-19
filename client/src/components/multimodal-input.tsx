import type { UIMessage } from 'ai';
import {
  useRef,
  useEffect,
  useState,
  useCallback,
  type Dispatch,
  type SetStateAction,
  type ChangeEvent,
  memo,
} from 'react';

import { toast } from 'sonner';
import { useLocalStorage, useWindowSize } from 'usehooks-ts';

import { PreviewAttachment } from './preview-attachment';
import { Button } from './ui/button';
import { SuggestedActions } from './suggested-actions';

import {
  PromptInput,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
  PromptInputSubmit,
} from './elements/prompt-input';

import equal from 'fast-deep-equal';
import type { UseChatHelpers } from '@ai-sdk/react';

import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDown,
  Paperclip,
} from 'lucide-react';

import { useScrollToBottom } from '@/hooks/use-scroll-to-bottom';

import type { VisibilityType } from './visibility-selector';
import type {
  Attachment,
  ChatMessage,
} from '@chat-template/core';

import { softNavigateToChatId } from '@/lib/navigation';
import { useAppConfig } from '@/contexts/AppConfigContext';

import { DbIcon } from './ui/db-icon';
import {
  ArrowUpIcon,
  StopIcon,
} from './icons';

function PureMultimodalInput({
  chatId,
  input,
  setInput,
  status,
  stop,
  attachments,
  setAttachments,
  messages,
  setMessages,
  sendMessage,
  selectedVisibilityType,
}: {
  chatId: string;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  status: UseChatHelpers<ChatMessage>['status'];
  stop: () => void;
  attachments: Array<Attachment>;
  setAttachments: Dispatch<SetStateAction<Array<Attachment>>>;
  messages: Array<UIMessage>;
  setMessages: UseChatHelpers<ChatMessage>['setMessages'];
  sendMessage: UseChatHelpers<ChatMessage>['sendMessage'];
  selectedVisibilityType: VisibilityType;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { width } = useWindowSize();
  const { chatHistoryEnabled } = useAppConfig();

  const [uploadQueue, setUploadQueue] = useState<Array<string>>([]);

  // ----------------------------------------------------------
  // Text area
  // ----------------------------------------------------------

  const adjustHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '44px';
    }
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      adjustHeight();
    }
  }, [adjustHeight]);

  const resetHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '44px';
    }
  }, []);

  // ----------------------------------------------------------
  // Local storage
  // ----------------------------------------------------------

  const [
    localStorageInput,
    setLocalStorageInput,
  ] = useLocalStorage('input', '');

  useEffect(() => {
    if (!textareaRef.current) {
      return;
    }

    const domValue = textareaRef.current.value;

    const finalValue =
      domValue || localStorageInput || '';

    setInput(finalValue);
    adjustHeight();
  }, [
    localStorageInput,
    setInput,
    adjustHeight,
  ]);

  useEffect(() => {
    setLocalStorageInput(input);
  }, [
    input,
    setLocalStorageInput,
  ]);

  const handleInput = (
    event: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    setInput(event.target.value);
  };

  // ----------------------------------------------------------
  // Submit message
  // ----------------------------------------------------------

  const submitForm = useCallback(() => {
    if (
      !input.trim() &&
      attachments.length === 0
    ) {
      return;
    }

    softNavigateToChatId(
      chatId,
      chatHistoryEnabled,
    );

    sendMessage({
      role: 'user',

      parts: [
        ...attachments.map(
          (attachment) => ({
            type: 'file' as const,
            url: attachment.url,
            name: attachment.name,
            mediaType:
              attachment.contentType,
          }),
        ),

        {
          type: 'text',
          text: input.trim(),
        },
      ],
    });

    setAttachments([]);
    setLocalStorageInput('');
    resetHeight();
    setInput('');

    // Clear the file input so the same file
    // can be selected again later.
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    if (width && width > 768) {
      textareaRef.current?.focus();
    }
  }, [
    input,
    attachments,
    sendMessage,
    setAttachments,
    setLocalStorageInput,
    resetHeight,
    setInput,
    width,
    chatId,
    chatHistoryEnabled,
  ]);

  // ----------------------------------------------------------
  // File upload
  // ----------------------------------------------------------

  const uploadFile = useCallback(
    async (file: File): Promise<Attachment | undefined> => {
      const formData = new FormData();

      formData.append('file', file);

      try {
        const response = await fetch(
          '/api/files/upload',
          {
            method: 'POST',
            body: formData,
          },
        );

        if (!response.ok) {
          let errorMessage =
            'Failed to upload file.';

          try {
            const errorData =
              await response.json();

            if (
              errorData &&
              typeof errorData.error === 'string'
            ) {
              errorMessage =
                errorData.error;
            }
          } catch {
            // Keep default error message.
          }

          throw new Error(errorMessage);
        }

        const data = await response.json();

        if (
          !data?.url ||
          !data?.pathname
        ) {
          throw new Error(
            'Upload response was invalid.',
          );
        }

        return {
          url: data.url,
          name: data.pathname,
          contentType:
            data.contentType ||
            file.type ||
            'application/octet-stream',
        };
      } catch (error) {
        console.error(
          '[Resume Upload] Upload failed:',
          error,
        );

        toast.error(
          error instanceof Error
            ? error.message
            : 'Failed to upload file.',
        );

        return undefined;
      }
    },
    [],
  );

  const handleFileChange =
    useCallback(
      async (
        event: ChangeEvent<HTMLInputElement>,
      ) => {
        const files = Array.from(
          event.target.files || [],
        );

        if (files.length === 0) {
          return;
        }

        // Resume screening should use document files.
        const allowedExtensions = [
          '.pdf',
          '.doc',
          '.docx',
          '.txt',
        ];

        const validFiles =
          files.filter((file) => {
            const lowerName =
              file.name.toLowerCase();

            return allowedExtensions.some(
              (extension) =>
                lowerName.endsWith(
                  extension,
                ),
            );
          });

        const invalidFiles =
          files.filter(
            (file) =>
              !validFiles.includes(file),
          );

        if (invalidFiles.length > 0) {
          toast.error(
            'Please upload PDF, DOC, DOCX, or TXT resume files.',
          );
        }

        if (validFiles.length === 0) {
          event.target.value = '';
          return;
        }

        // Maximum 10 MB per file.
        const tooLargeFiles =
          validFiles.filter(
            (file) =>
              file.size > 10 * 1024 * 1024,
          );

        if (tooLargeFiles.length > 0) {
          toast.error(
            'Each resume must be 10 MB or smaller.',
          );
        }

        const filesToUpload =
          validFiles.filter(
            (file) =>
              file.size <=
              10 * 1024 * 1024,
          );

        if (filesToUpload.length === 0) {
          event.target.value = '';
          return;
        }

        setUploadQueue(
          filesToUpload.map(
            (file) => file.name,
          ),
        );

        try {
          const uploadedAttachments =
            await Promise.all(
              filesToUpload.map(
                (file) =>
                  uploadFile(file),
              ),
            );

          const successfulUploads =
            uploadedAttachments.filter(
              (
                attachment,
              ): attachment is Attachment =>
                attachment !== undefined,
            );

          if (
            successfulUploads.length > 0
          ) {
            setAttachments(
              (currentAttachments) => [
                ...currentAttachments,
                ...successfulUploads,
              ],
            );
          }
        } catch (error) {
          console.error(
            '[Resume Upload] Error:',
            error,
          );
        } finally {
          setUploadQueue([]);

          // Allow selecting the same file again.
          event.target.value = '';
        }
      },
      [
        setAttachments,
        uploadFile,
      ],
    );

  // ----------------------------------------------------------
  // Scroll
  // ----------------------------------------------------------

  const {
    isAtBottom,
    scrollToBottom,
  } = useScrollToBottom();

  useEffect(() => {
    if (status === 'submitted') {
      scrollToBottom();
    }
  }, [
    status,
    scrollToBottom,
  ]);

  // ----------------------------------------------------------
  // UI
  // ----------------------------------------------------------

  const isBusy =
    status === 'submitted' ||
    status === 'streaming';

  return (
    <div className="relative flex w-full flex-col gap-4">
      {/* Scroll-to-bottom */}
      <AnimatePresence>
        {!isAtBottom && (
          <motion.div
            initial={{
              opacity: 0,
              y: 10,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            exit={{
              opacity: 0,
              y: 10,
            }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 20,
            }}
            className="-top-12 -translate-x-1/2 absolute left-1/2 z-50"
          >
            <Button
              data-testid="scroll-to-bottom-button"
              className="rounded-full"
              size="icon"
              variant="outline"
              onClick={(event) => {
                event.preventDefault();
                scrollToBottom();
              }}
            >
              <ArrowDown />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        className="fixed -left-4 -top-4 size-0.5 opacity-0 pointer-events-none"
        accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
        multiple
        onChange={handleFileChange}
        tabIndex={-1}
      />

      <div className="w-full rounded-[24px] border-4 border-black/[0.02] dark:border-white/[0.02]">
        <PromptInput
          className="rounded-[24px] border border-black/[0.08] bg-background/75 p-4 backdrop-blur-sm transition-all duration-200 dark:border-white/[0.08]"
          onSubmit={(event) => {
            event.preventDefault();

            if (isBusy) {
              toast.error(
                'Please wait for the current response to finish.',
              );
              return;
            }

            submitForm();
          }}
        >
          {/* Uploaded files */}
          {(attachments.length > 0 ||
            uploadQueue.length > 0) && (
            <div
              data-testid="attachments-preview"
              className="flex flex-row items-end gap-2 overflow-x-auto pb-2"
            >
              {attachments.map(
                (attachment) => (
                  <PreviewAttachment
                    key={attachment.url}
                    attachment={attachment}
                    onRemove={() => {
                      setAttachments(
                        (
                          currentAttachments,
                        ) =>
                          currentAttachments.filter(
                            (item) =>
                              item.url !==
                              attachment.url,
                          ),
                      );

                      if (
                        fileInputRef.current
                      ) {
                        fileInputRef.current.value =
                          '';
                      }
                    }}
                  />
                ),
              )}

              {uploadQueue.map(
                (filename) => (
                  <PreviewAttachment
                    key={filename}
                    attachment={{
                      url: '',
                      name: filename,
                      contentType: '',
                    }}
                    isUploading
                  />
                ),
              )}
            </div>
          )}

          {/* Message text area */}
          <div className="flex flex-row items-start gap-1 sm:gap-2">
            <PromptInputTextarea
              data-testid="multimodal-input"
              ref={textareaRef}
              placeholder="Enter job requirements or ask the Resume Screening Agent..."
              value={input}
              onChange={handleInput}
              minHeight={44}
              maxHeight={200}
              disableAutoResize
              className="grow resize-none border-0! border-none! bg-transparent p-2 text-base outline-none ring-0 [-ms-overflow-style:none] [scrollbar-width:none] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 [&::-webkit-scrollbar]:hidden"
              rows={1}
              autoFocus
            />
          </div>

          {/* Toolbar */}
          <PromptInputToolbar className="!border-top-0 border-t-0! p-0 shadow-none dark:border-0 dark:border-transparent!">
            <PromptInputTools className="gap-0 sm:gap-0.5">
              {/* Resume upload button */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 rounded-full"
                onClick={(event) => {
                  event.preventDefault();
                  fileInputRef.current?.click();
                }}
                disabled={isBusy}
                title="Upload candidate resume"
                aria-label="Upload candidate resume"
              >
                <Paperclip className="size-4" />
              </Button>
            </PromptInputTools>

            {/* Submit / Stop */}
            {isBusy ? (
              <StopButton
                stop={stop}
                setMessages={setMessages}
              />
            ) : (
              <PromptInputSubmit
                data-testid="send-button"
                status={status}
                variant="tertiary"
                disabled={
                  (!input.trim() &&
                    attachments.length === 0) ||
                  uploadQueue.length > 0
                }
                className="size-8 rounded-full bg-secondary hover:bg-action-tertiary-background-hover text-foreground transition-colors duration-200 disabled:opacity-50 disabled:text-muted-foreground"
              >
                <DbIcon
                  icon={ArrowUpIcon}
                  className="size-4"
                />
              </PromptInputSubmit>
            )}
          </PromptInputToolbar>
        </PromptInput>
      </div>

      <p className="-mt-2 text-center text-sm text-muted-foreground">
        Upload a resume and enter the job requirements, then send to start screening.
      </p>

      {/* Suggested actions */}
      {messages.length === 0 &&
        attachments.length === 0 &&
        uploadQueue.length === 0 && (
          <SuggestedActions
            sendMessage={sendMessage}
            chatId={chatId}
            selectedVisibilityType={
              selectedVisibilityType
            }
          />
        )}
    </div>
  );
}

export const MultimodalInput = memo(
  PureMultimodalInput,
  (prevProps, nextProps) => {
    if (
      prevProps.input !==
      nextProps.input
    ) {
      return false;
    }

    if (
      prevProps.status !==
      nextProps.status
    ) {
      return false;
    }

    if (
      !equal(
        prevProps.attachments,
        nextProps.attachments,
      )
    ) {
      return false;
    }

    if (
      prevProps.selectedVisibilityType !==
      nextProps.selectedVisibilityType
    ) {
      return false;
    }

    return true;
  },
);

function PureStopButton({
  stop,
  setMessages,
}: {
  stop: () => void;
  setMessages: UseChatHelpers<ChatMessage>['setMessages'];
}) {
  return (
    <Button
      data-testid="stop-button"
      type="button"
      className="size-7 rounded-full bg-foreground p-1 text-background transition-colors duration-200 hover:bg-foreground/90 disabled:bg-muted disabled:text-muted-foreground"
      onClick={(event) => {
        event.preventDefault();
        stop();
        setMessages(
          (messages) => messages,
        );
      }}
    >
      <DbIcon
        icon={StopIcon}
        className="size-4"
      />
    </Button>
  );
}

const StopButton = memo(
  PureStopButton,
);