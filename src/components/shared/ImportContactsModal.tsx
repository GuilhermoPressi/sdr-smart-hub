import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, ArrowRight, CheckCircle2, AlertCircle, Loader2, X, Table } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ImportContactsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

type Step = 1 | 2 | 3 | 4;

const SYSTEM_FIELDS = [
  { id: "name", label: "Nome", required: false },
  { id: "phone", label: "Telefone", required: true },
  { id: "email", label: "E-mail", required: false },
  { id: "companyName", label: "Empresa", required: false },
  { id: "jobTitle", label: "Cargo", required: false },
  { id: "city", label: "Cidade", required: false },
  { id: "state", label: "Estado", required: false },
];

export function ImportContactsModal({ open, onOpenChange, onComplete }: ImportContactsModalProps) {
  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [results, setResults] = useState<any>(null);

  // Config flags
  const [tag, setTag] = useState("");
  const [stage, setStage] = useState("novo");
  const [ignoreDuplicates, setIgnoreDuplicates] = useState(true);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [createWithoutName, setCreateWithoutName] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      toast.error("Por favor, selecione um arquivo CSV.");
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      toast.error("O arquivo deve ter no máximo 5MB.");
      return;
    }

    setFile(selectedFile);
    parsePreview(selectedFile);
  };

  const parsePreview = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 1) return;

      const firstLine = lines[0];
      const counts = {
        ',': (firstLine.match(/,/g) || []).length,
        ';': (firstLine.match(/;/g) || []).length,
        '\t': (firstLine.match(/\t/g) || []).length,
      };
      let sep = ',';
      if (counts[';'] > counts[','] && counts[';'] > counts['\t']) sep = ';';
      else if (counts['\t'] > counts[','] && counts['\t'] > counts[';']) sep = '\t';
      
      const parseCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let cur = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') inQuotes = !inQuotes;
          else if (char === sep && !inQuotes) {
            result.push(cur.trim());
            cur = "";
          } else cur += char;
        }
        result.push(cur.trim());
        return result;
      };

      const rows = lines.slice(0, 11).map(parseCSVLine);
      const csvHeaders = rows[0].map(h => h.replace(/"/g, ''));
      setHeaders(csvHeaders);
      setPreviewRows(rows.slice(1));

      // Auto-mapping (apenas se houver correspondência exata ou muito próxima)
      const newMapping: Record<string, string> = {};
      csvHeaders.forEach(h => {
        const lower = h.toLowerCase().trim();
        if (lower === 'nome' || lower === 'name') newMapping['name'] = h;
        else if (['telefone', 'phone', 'whatsapp', 'celular', 'fone', 'tel'].includes(lower)) newMapping['phone'] = h;
        else if (lower === 'email' || lower === 'e-mail') newMapping['email'] = h;
        else if (['empresa', 'company', 'organization'].includes(lower)) newMapping['companyName'] = h;
      });
      setMapping(newMapping);
      setStep(2);
    };
    reader.readAsText(file);
  };

  const handleStartImport = async () => {
    if (!file) {
      toast.error("Nenhum arquivo selecionado.");
      return;
    }
    
    // Check required mappings
    const phoneMapped = Object.entries(mapping).find(([sys]) => sys === 'phone' && mapping['phone']);
    if (!phoneMapped) {
      toast.error("O campo 'Telefone' é obrigatório para a importação.");
      return;
    }

    setIsUploading(true);
    setStep(4);
    try {
      const res = await api.importContacts(file, mapping, {
        tag,
        stage,
        ignoreDuplicates,
        updateExisting,
        createWithoutName
      });
      setResults(res);
      toast.success("Importação concluída!");
    } catch (error: any) {
      console.error('[Import] Erro na importação:', error);
      toast.error(error.message || "Erro ao importar contatos");
      setResults(null);
      // Mantemos no step 4 para mostrar a tela de erro, não volta para step 3 (black screen)
    } finally {
      setIsUploading(false);
    }
  };

  const reset = () => {
    setStep(1);
    setFile(null);
    setHeaders([]);
    setPreviewRows([]);
    setMapping({});
    setResults(null);
    setTag("");
    setIsUploading(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isUploading) { onOpenChange(v); if(!v) reset(); } }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="p-6 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-display font-bold">Importar Contatos</DialogTitle>
            <div className="flex items-center gap-2">
              {[1, 2, 3].map(s => (
                <div 
                  key={s} 
                  className={cn(
                    "h-2 w-8 rounded-full transition-colors", 
                    step >= s ? "bg-primary" : "bg-muted"
                  )} 
                />
              ))}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6">
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <div 
                className="border-2 border-dashed border-border rounded-2xl p-12 text-center space-y-4 hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="h-16 w-16 bg-primary/10 rounded-full grid place-items-center mx-auto">
                  <Upload className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold text-lg">Selecione seu arquivo CSV</h4>
                  <p className="text-sm text-muted-foreground">Clique para procurar ou arraste o arquivo aqui</p>
                </div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Tamanho máximo: 5MB • Formato: .csv</p>
                <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileSelect} />
              </div>

              <div className="bg-surface rounded-xl p-4 space-y-3">
                <h5 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Dicas para uma boa importação</h5>
                <ul className="text-sm space-y-2 text-foreground/80">
                  <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" /> Certifique-se de que a primeira linha contém os cabeçalhos.</li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" /> A coluna de telefone é obrigatória.</li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" /> Use ponto e vírgula (;) ou vírgula (,) como separador.</li>
                </ul>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                <Table className="h-4 w-4" />
                Mapeie as colunas do seu arquivo para os campos do sistema.
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 pb-2 border-b text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
                  <div>Coluna do CSV</div>
                  <div>Campo no Sistema</div>
                </div>
                
                {SYSTEM_FIELDS.map(field => (
                  <div key={field.id} className="grid grid-cols-2 gap-4 items-center">
                    <div className="text-sm font-medium">{field.label} {field.required && <span className="text-destructive">*</span>}</div>
                    <Select 
                      value={mapping[field.id] || "ignore"} 
                      onValueChange={(v) => setMapping(prev => ({ ...prev, [field.id]: v === "ignore" ? "" : v }))}
                    >
                      <SelectTrigger className={cn(!mapping[field.id] && field.required && "border-destructive")}>
                        <SelectValue placeholder="Ignorar campo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ignore">Ignorar</SelectItem>
                        {headers.map(h => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              <div className="mt-8 space-y-3">
                <h5 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Prévia dos dados (primeiras linhas)</h5>
                <div className="border rounded-xl overflow-hidden overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/50">
                      <tr>
                        {headers.map(h => <th key={h} className="px-3 py-2 border-r last:border-0">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, i) => (
                        <tr key={i} className="border-t">
                          {row.map((cell, j) => <td key={j} className="px-3 py-2 border-r last:border-0 truncate max-w-[150px]">{cell}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="space-y-3">
                    <Label className="text-sm font-bold">Adicionar Tag Global</Label>
                    <Input 
                      placeholder="Ex: Importação Maio, Evento SP..." 
                      value={tag}
                      onChange={(e) => setTag(e.target.value)}
                    />
                    <p className="text-[11px] text-muted-foreground">Esta tag será aplicada a todos os contatos importados.</p>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm font-bold">Etapa do Pipeline</Label>
                    <Select value={stage} onValueChange={setStage}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="novo">Novo Lead</SelectItem>
                        <SelectItem value="qualificado">Qualificado</SelectItem>
                        <SelectItem value="ganho">Ganho</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-6">
                  <Label className="text-sm font-bold block mb-4">Regras de Negócio</Label>
                  
                  <div className="flex items-start space-x-3">
                    <Checkbox id="ignore" checked={ignoreDuplicates} onCheckedChange={(v) => setIgnoreDuplicates(v as boolean)} />
                    <div className="grid gap-1.5 leading-none">
                      <label htmlFor="ignore" className="text-sm font-medium leading-none cursor-pointer">Ignorar duplicados</label>
                      <p className="text-xs text-muted-foreground">Se o telefone já existir, não faz nada.</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Checkbox id="update" checked={updateExisting} onCheckedChange={(v) => setUpdateExisting(v as boolean)} />
                    <div className="grid gap-1.5 leading-none">
                      <label htmlFor="update" className="text-sm font-medium leading-none cursor-pointer">Atualizar existentes</label>
                      <p className="text-xs text-muted-foreground">Se o telefone já existir, atualiza os dados.</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Checkbox id="noname" checked={createWithoutName} onCheckedChange={(v) => setCreateWithoutName(v as boolean)} />
                    <div className="grid gap-1.5 leading-none">
                      <label htmlFor="noname" className="text-sm font-medium leading-none cursor-pointer">Importar sem nome</label>
                      <p className="text-xs text-muted-foreground">Cria o contato mesmo se a coluna nome estiver vazia.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="py-12 text-center space-y-6 animate-in zoom-in duration-300">
              {isUploading ? (
                <>
                  <div className="relative h-24 w-24 mx-auto">
                    <Loader2 className="h-24 w-24 text-primary animate-spin" />
                    <div className="absolute inset-0 grid place-items-center">
                      <Upload className="h-8 w-8 text-primary" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xl font-bold">Importando contatos...</h4>
                    <p className="text-sm text-muted-foreground">Por favor, não feche esta janela.</p>
                  </div>
                  <Progress value={45} className="max-w-xs mx-auto" />
                </>
              ) : results ? (
                <div className="space-y-8">
                  <div className="h-20 w-20 bg-success/10 rounded-full grid place-items-center mx-auto">
                    <CheckCircle2 className="h-10 w-10 text-success" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-2xl font-bold">Importação Concluída</h4>
                    <p className="text-sm text-muted-foreground">O processo foi finalizado com sucesso.</p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="bg-surface rounded-2xl p-4 border border-border-subtle">
                      <p className="text-2xl font-bold text-primary">{results.imported}</p>
                      <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Novos</p>
                    </div>
                    <div className="bg-surface rounded-2xl p-4 border border-border-subtle">
                      <p className="text-2xl font-bold text-success">{results.updated || 0}</p>
                      <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Atualizados</p>
                    </div>
                    <div className="bg-surface rounded-2xl p-4 border border-border-subtle">
                      <p className="text-2xl font-bold text-accent">{results.recovered || 0}</p>
                      <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Recuperados</p>
                    </div>
                    <div className="bg-surface rounded-2xl p-4 border border-border-subtle">
                      <p className="text-2xl font-bold text-warning">{results.duplicates}</p>
                      <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Ignorados</p>
                    </div>
                    <div className="bg-surface rounded-2xl p-4 border border-border-subtle">
                      <p className="text-2xl font-bold text-destructive">{results.invalid}</p>
                      <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Inválidos</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                   <AlertCircle className="h-16 w-16 text-destructive mx-auto" />
                   <h4 className="text-xl font-bold">Ocorreu um erro</h4>
                   <Button onClick={() => setStep(3)}>Tentar novamente</Button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-6 border-t bg-muted/20 flex items-center justify-between">
          {step < 4 ? (
            <>
              <Button variant="ghost" onClick={() => step === 1 ? onOpenChange(false) : setStep((step - 1) as Step)}>
                {step === 1 ? "Cancelar" : "Voltar"}
              </Button>
              <Button 
                onClick={() => step === 3 ? handleStartImport() : setStep((step + 1) as Step)}
                disabled={step === 1 && !file}
                className="bg-gradient-primary text-primary-foreground shadow-glow"
              >
                {step === 3 ? "Iniciar Importação" : "Continuar"}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </>
          ) : (
            <Button className="w-full" onClick={() => { onOpenChange(false); onComplete(); }}>
              Fechar e ver contatos
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
