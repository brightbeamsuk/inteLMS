import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export interface TextElement {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  color: string;
  textAlign: 'left' | 'center' | 'right';
  lineHeight: number;
}

export interface CertificateTemplate {
  id?: string;
  name: string;
  width: number;
  height: number;
  backgroundColor: string;
  backgroundImage?: string;
  elements: TextElement[];
  isDefault?: boolean;
  organisationId?: string | null;
}

interface VisualCertificateEditorProps {
  onSave?: (template: CertificateTemplate) => void;
  initialTemplate?: CertificateTemplate;
}

const PLACEHOLDERS = [
  '{{USERNAME}}',
  '{{USER_EMAIL}}',
  '{{COURSE_NAME}}',
  '{{COURSE_ID}}',
  '{{ORGANISATION_NAME}}',
  '{{ADMIN_NAME}}',
  '{{SCORE_PERCENT}}',
  '{{PASS_FAIL}}',
  '{{DATE_COMPLETED}}',
  '{{CERTIFICATE_ID}}'
];

const FONT_FAMILIES = [
  'Arial, sans-serif',
  'Georgia, serif',
  'Times New Roman, serif',
  'Helvetica, sans-serif',
  'Courier New, monospace',
  'Verdana, sans-serif',
  'Impact, sans-serif'
];

export function VisualCertificateEditor({ onSave, initialTemplate }: VisualCertificateEditorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLDivElement>(null);
  
  // Template state
  const [template, setTemplate] = useState<CertificateTemplate>(initialTemplate || {
    name: 'New Certificate Template',
    width: 800,
    height: 600,
    backgroundColor: '#ffffff',
    elements: []
  });
  
  // Editor state
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showPreview, setShowPreview] = useState(false);

  // Get selected element
  const selectedElement = template.elements.find(el => el.id === selectedElementId);

  // Save template mutation
  const saveTemplateMutation = useMutation({
    mutationFn: async (templateData: CertificateTemplate) => {
      const response = await apiRequest('POST', '/api/certificate-templates', templateData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Certificate template saved successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/certificate-templates'] });
      onSave?.(template);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save certificate template",
        variant: "destructive",
      });
    },
  });

  // Add new text element
  const addTextElement = useCallback(() => {
    const newElement: TextElement = {
      id: `element_${Date.now()}`,
      x: 50,
      y: 50,
      width: 200,
      height: 40,
      text: 'Click to edit text',
      fontSize: 16,
      fontFamily: 'Arial, sans-serif',
      fontWeight: 'normal',
      color: '#000000',
      textAlign: 'left',
      lineHeight: 1.2
    };
    
    setTemplate(prev => ({
      ...prev,
      elements: [...prev.elements, newElement]
    }));
    setSelectedElementId(newElement.id);
  }, []);

  // Update element
  const updateElement = useCallback((elementId: string, updates: Partial<TextElement>) => {
    setTemplate(prev => ({
      ...prev,
      elements: prev.elements.map(el => 
        el.id === elementId ? { ...el, ...updates } : el
      )
    }));
  }, []);

  // Delete element
  const deleteElement = useCallback((elementId: string) => {
    setTemplate(prev => ({
      ...prev,
      elements: prev.elements.filter(el => el.id !== elementId)
    }));
    setSelectedElementId(null);
  }, []);

  // Handle mouse events for dragging
  const handleMouseDown = useCallback((e: React.MouseEvent, elementId: string) => {
    e.preventDefault();
    setSelectedElementId(elementId);
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !selectedElementId) return;
    
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    
    updateElement(selectedElementId, {
      x: Math.max(0, (selectedElement?.x || 0) + deltaX),
      y: Math.max(0, (selectedElement?.y || 0) + deltaY)
    });
    
    setDragStart({ x: e.clientX, y: e.clientY });
  }, [isDragging, selectedElementId, dragStart, selectedElement, updateElement]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Insert placeholder into selected element
  const insertPlaceholder = useCallback((placeholder: string) => {
    if (!selectedElement) return;
    
    updateElement(selectedElement.id, {
      text: selectedElement.text + placeholder
    });
  }, [selectedElement, updateElement]);

  // Preview with sample data
  const getPreviewData = () => {
    const sampleData = {
      '{{USERNAME}}': 'John Doe',
      '{{USER_EMAIL}}': 'john.doe@company.com',
      '{{COURSE_NAME}}': 'GDPR Training Course',
      '{{COURSE_ID}}': 'GDPR-001',
      '{{ORGANISATION_NAME}}': 'Acme Corporation',
      '{{ADMIN_NAME}}': 'Sarah Admin',
      '{{SCORE_PERCENT}}': '95%',
      '{{PASS_FAIL}}': 'PASSED',
      '{{DATE_COMPLETED}}': new Date().toLocaleDateString(),
      '{{CERTIFICATE_ID}}': 'CERT-2025-001'
    };

    return {
      ...template,
      elements: template.elements.map(el => ({
        ...el,
        text: Object.entries(sampleData).reduce((text, [placeholder, value]) => 
          text.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value), el.text
        )
      }))
    };
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-screen max-h-[800px]">
      {/* Canvas Area */}
      <div className="lg:col-span-2 border border-base-300 rounded-lg overflow-hidden">
        <div className="bg-base-100 p-4 border-b">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Certificate Canvas</h3>
            <div className="flex gap-2">
              <button 
                className="btn btn-sm btn-primary" 
                onClick={addTextElement}
                data-testid="button-add-text"
              >
                <i className="fas fa-plus"></i> Add Text
              </button>
              <button 
                className="btn btn-sm btn-secondary" 
                onClick={() => setShowPreview(!showPreview)}
                data-testid="button-toggle-preview"
              >
                <i className="fas fa-eye"></i> {showPreview ? 'Edit' : 'Preview'}
              </button>
            </div>
          </div>
        </div>
        
        <div className="p-4 bg-base-200 overflow-auto" style={{ height: 'calc(100% - 70px)' }}>
          <div 
            ref={canvasRef}
            className="relative border-2 border-dashed border-base-300 mx-auto"
            style={{ 
              width: template.width,
              height: template.height,
              backgroundColor: template.backgroundColor,
              backgroundImage: template.backgroundImage ? `url(${template.backgroundImage})` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            data-testid="certificate-canvas"
          >
            {(showPreview ? getPreviewData() : template).elements.map(element => (
              <div
                key={element.id}
                className={`absolute cursor-move border-2 transition-all ${
                  selectedElementId === element.id ? 'border-primary bg-primary/10' : 'border-transparent hover:border-base-300'
                }`}
                style={{
                  left: element.x,
                  top: element.y,
                  width: element.width,
                  height: element.height,
                  fontSize: element.fontSize,
                  fontFamily: element.fontFamily,
                  fontWeight: element.fontWeight,
                  color: element.color,
                  textAlign: element.textAlign,
                  lineHeight: element.lineHeight,
                  padding: '4px',
                  overflow: 'hidden'
                }}
                onMouseDown={(e) => !showPreview && handleMouseDown(e, element.id)}
                data-testid={`text-element-${element.id}`}
              >
                {element.text}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Properties Panel */}
      <div className="border border-base-300 rounded-lg">
        <div className="bg-base-100 p-4 border-b">
          <h3 className="font-semibold">Properties</h3>
        </div>
        
        <div className="p-4 space-y-4 overflow-y-auto" style={{ height: 'calc(100% - 70px)' }}>
          {/* Template Settings */}
          <div className="space-y-3">
            <h4 className="font-medium">Template Settings</h4>
            
            <div className="form-control">
              <label className="label">
                <span className="label-text">Template Name</span>
              </label>
              <input 
                type="text" 
                className="input input-sm input-bordered"
                value={template.name}
                onChange={(e) => setTemplate(prev => ({ ...prev, name: e.target.value }))}
                data-testid="input-template-name"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Width</span>
                </label>
                <input 
                  type="number" 
                  className="input input-sm input-bordered"
                  value={template.width}
                  onChange={(e) => setTemplate(prev => ({ ...prev, width: parseInt(e.target.value) || 800 }))}
                  data-testid="input-template-width"
                />
              </div>
              
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Height</span>
                </label>
                <input 
                  type="number" 
                  className="input input-sm input-bordered"
                  value={template.height}
                  onChange={(e) => setTemplate(prev => ({ ...prev, height: parseInt(e.target.value) || 600 }))}
                  data-testid="input-template-height"
                />
              </div>
            </div>
            
            <div className="form-control">
              <label className="label">
                <span className="label-text">Background Color</span>
              </label>
              <input 
                type="color" 
                className="input input-sm input-bordered"
                value={template.backgroundColor}
                onChange={(e) => setTemplate(prev => ({ ...prev, backgroundColor: e.target.value }))}
                data-testid="input-background-color"
              />
            </div>
          </div>

          {/* Placeholders */}
          <div className="space-y-3">
            <h4 className="font-medium">Placeholders</h4>
            <div className="text-xs text-base-content/60 mb-2">
              Click to insert into selected text element
            </div>
            <div className="grid grid-cols-1 gap-1">
              {PLACEHOLDERS.map(placeholder => (
                <button
                  key={placeholder}
                  className="btn btn-xs btn-ghost justify-start text-xs"
                  onClick={() => insertPlaceholder(placeholder)}
                  disabled={!selectedElement}
                  data-testid={`button-placeholder-${placeholder}`}
                >
                  {placeholder}
                </button>
              ))}
            </div>
          </div>

          {/* Element Properties */}
          {selectedElement && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="font-medium">Text Element</h4>
                <button 
                  className="btn btn-xs btn-error"
                  onClick={() => deleteElement(selectedElement.id)}
                  data-testid="button-delete-element"
                >
                  <i className="fas fa-trash"></i>
                </button>
              </div>
              
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Text Content</span>
                </label>
                <textarea 
                  className="textarea textarea-sm textarea-bordered"
                  value={selectedElement.text}
                  onChange={(e) => updateElement(selectedElement.id, { text: e.target.value })}
                  data-testid="textarea-element-text"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">X Position</span>
                  </label>
                  <input 
                    type="number" 
                    className="input input-sm input-bordered"
                    value={selectedElement.x}
                    onChange={(e) => updateElement(selectedElement.id, { x: parseInt(e.target.value) || 0 })}
                    data-testid="input-element-x"
                  />
                </div>
                
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Y Position</span>
                  </label>
                  <input 
                    type="number" 
                    className="input input-sm input-bordered"
                    value={selectedElement.y}
                    onChange={(e) => updateElement(selectedElement.id, { y: parseInt(e.target.value) || 0 })}
                    data-testid="input-element-y"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Width</span>
                  </label>
                  <input 
                    type="number" 
                    className="input input-sm input-bordered"
                    value={selectedElement.width}
                    onChange={(e) => updateElement(selectedElement.id, { width: parseInt(e.target.value) || 100 })}
                    data-testid="input-element-width"
                  />
                </div>
                
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Height</span>
                  </label>
                  <input 
                    type="number" 
                    className="input input-sm input-bordered"
                    value={selectedElement.height}
                    onChange={(e) => updateElement(selectedElement.id, { height: parseInt(e.target.value) || 30 })}
                    data-testid="input-element-height"
                  />
                </div>
              </div>
              
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Font Family</span>
                </label>
                <select 
                  className="select select-sm select-bordered"
                  value={selectedElement.fontFamily}
                  onChange={(e) => updateElement(selectedElement.id, { fontFamily: e.target.value })}
                  data-testid="select-element-font"
                >
                  {FONT_FAMILIES.map(font => (
                    <option key={font} value={font}>{font.split(',')[0]}</option>
                  ))}
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Font Size</span>
                  </label>
                  <input 
                    type="number" 
                    className="input input-sm input-bordered"
                    value={selectedElement.fontSize}
                    onChange={(e) => updateElement(selectedElement.id, { fontSize: parseInt(e.target.value) || 16 })}
                    data-testid="input-element-font-size"
                  />
                </div>
                
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Font Weight</span>
                  </label>
                  <select 
                    className="select select-sm select-bordered"
                    value={selectedElement.fontWeight}
                    onChange={(e) => updateElement(selectedElement.id, { fontWeight: e.target.value })}
                    data-testid="select-element-weight"
                  >
                    <option value="normal">Normal</option>
                    <option value="bold">Bold</option>
                    <option value="lighter">Lighter</option>
                  </select>
                </div>
              </div>
              
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Text Color</span>
                </label>
                <input 
                  type="color" 
                  className="input input-sm input-bordered"
                  value={selectedElement.color}
                  onChange={(e) => updateElement(selectedElement.id, { color: e.target.value })}
                  data-testid="input-element-color"
                />
              </div>
              
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Text Align</span>
                </label>
                <select 
                  className="select select-sm select-bordered"
                  value={selectedElement.textAlign}
                  onChange={(e) => updateElement(selectedElement.id, { textAlign: e.target.value as 'left' | 'center' | 'right' })}
                  data-testid="select-element-align"
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
            </div>
          )}

          {/* Save Button */}
          <div className="pt-4">
            <button 
              className="btn btn-primary w-full"
              onClick={() => saveTemplateMutation.mutate(template)}
              disabled={saveTemplateMutation.isPending}
              data-testid="button-save-template"
            >
              {saveTemplateMutation.isPending ? (
                <span className="loading loading-spinner loading-sm"></span>
              ) : (
                <i className="fas fa-save"></i>
              )}
              Save Template
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}