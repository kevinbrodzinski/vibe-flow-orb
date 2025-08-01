'use client';
import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, Share2, Download, QrCode, Loader2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { ShareCard, TEMPLATES, TemplateType } from './CardTemplates';
import { AfterglowDetail } from '@/lib/afterglow-helpers';
import { captureNodeToPng, shareOrDownload } from '@/lib/share/generateShareImage';
import { useShareLink } from '@/hooks/useShareLink';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  afterglow: AfterglowDetail['afterglow'];
}

export default function ShareModal({ open, onOpenChange, afterglow }: Props) {
  const [template, setTemplate] = useState<TemplateType>('gradient');
  const previewRef = useRef<HTMLDivElement>(null);
  const [processing, setProcessing] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const { toast } = useToast();
  const { data: shareLink, isMutating: creatingLink, trigger: createShareLink } = useShareLink(afterglow.id);

  const handleImageShare = async () => {
    if (!previewRef.current || processing) return;
    setProcessing(true);
    try {
      const blob = await captureNodeToPng(previewRef.current);
      await shareOrDownload(blob, `afterglow-${afterglow.date}.png`);
    } finally {
      setProcessing(false);
    }
  };

  const handleCopyLink = async () => {
    if (!shareLink) return;
    
    try {
      // Check if clipboard API is available and we're in a secure context
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareLink.url);
        toast({
          title: "Link copied!",
          description: "Share link has been copied to your clipboard.",
        });
      } else {
        // Fallback for older browsers or insecure contexts
        const textArea = document.createElement('textarea');
        textArea.value = shareLink.url;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
          document.execCommand('copy');
          toast({
            title: "Link copied!",
            description: "Share link has been copied to your clipboard.",
          });
        } catch {
          toast({
            title: "Copy failed",
            description: "Long-press to select and copy the link manually.",
            variant: "destructive",
          });
        } finally {
          document.body.removeChild(textArea);
        }
      }
    } catch (err) {
      console.error('Failed to copy link:', err);
      toast({
        title: "Copy failed",
        description: "Long-press to select and copy the link manually.",
        variant: "destructive",
      });
    }
  };

  const handleGenerateLink = async () => {
    try {
      await createShareLink();
      toast({
        title: "Link generated!",
        description: "Your shareable link has been created.",
      });
    } catch (err) {
      console.error('Failed to generate link:', err);
      toast({
        title: "Generation failed",
        description: "Could not generate share link.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>Share your Afterglow</DialogHeader>

          <div className="space-y-6">
            {/* Share Link Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Share Link</h3>
              
              {shareLink ? (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={shareLink.url}
                      className="flex-1"
                      onClick={(e) => e.currentTarget.select()}
                    />
                    <Button
                      onClick={handleCopyLink}
                      size="sm"
                      variant="outline"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setQrOpen(true)}
                    >
                      <QrCode className="w-4 h-4 mr-2" />
                      QR
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Anyone with this link can view your afterglow
                  </p>
                </div>
              ) : (
                <Button
                  onClick={handleGenerateLink}
                  disabled={creatingLink || processing}
                  variant="outline"
                  className="w-full"
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  {creatingLink ? 'Generating Link...' : 'Generate Share Link'}
                </Button>
              )}
            </div>

            {/* Image Share Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Download Image</h3>
              
              {/* template selector */}
              <div>
                <Label className="text-sm font-medium">Template</Label>
                <div className="flex gap-2 mt-2">
                  {TEMPLATES.map((tpl) => (
                    <Button
                      key={tpl}
                      size="sm"
                      variant={tpl === template ? 'default' : 'outline'}
                      onClick={() => setTemplate(tpl)}
                    >
                      {tpl}
                    </Button>
                  ))}
                </div>
              </div>

              {/* live preview (scaled down) */}
              <div className="w-full h-80 overflow-hidden rounded-lg shadow relative bg-muted">
                <div className="scale-[0.33] origin-top-left absolute -top-10 -left-10 transform translateZ(0)">
                  <ShareCard data={afterglow} template={template} />
                </div>
              </div>

              <Button onClick={handleImageShare} disabled={processing} className="w-full">
                <Download className="w-4 h-4 mr-2" />
                {processing ? 'Rendering…' : 'Download Image'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="flex flex-col items-center gap-4 max-w-sm">
          <DialogHeader>Share via QR Code</DialogHeader>
          {shareLink ? (
            <>
              <a 
                href={shareLink.url} 
                download={`afterglow-${afterglow.date}.png`}
                className="block"
              >
                <QRCodeSVG 
                  value={shareLink.url} 
                  size={224}
                  className="border rounded-lg"
                />
              </a>
              <p className="text-xs text-muted-foreground text-center break-all px-4">
                {shareLink.url}
              </p>
            </>
          ) : (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span className="text-sm text-muted-foreground">Loading...</span>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Hidden capture node rendered outside dialog via portal */}
      {open && createPortal(
        <div
          style={{ position: 'fixed', top: '-9999px', left: '-9999px' }}
          aria-hidden="true"
        >
          <ShareCard ref={previewRef} data={afterglow} template={template} />
        </div>,
        document.body
      )}
    </>
  );
}