import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Pencil, RefreshCw } from 'lucide-react';

interface SheetData {
  headers: string[];
  rows: string[][];
}

export default function SpreadsheetEditor() {
  const { user, session } = useAuth();
  const [data, setData] = useState<SheetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [editData, setEditData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const userEmail = user?.email?.toLowerCase() || '';

  const fetchData = async () => {
    if (!session) return;

    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('google-sheets', {
        body: { action: 'read' },
      });

      if (error) throw error;

      if (result.data && result.data.length > 0) {
        setData({
          headers: result.data[0],
          rows: result.data.slice(1),
        });
      }
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast.error('無法載入資料');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [session]);

  const canEditRow = (row: string[]) => {
    // Column A (index 0) contains email - user can only edit their own rows
    const rowEmail = row[0]?.toLowerCase().trim();
    return rowEmail === userEmail;
  };

  const handleEdit = (rowIndex: number) => {
    if (!data) return;
    
    const row = data.rows[rowIndex];
    const rowData: Record<string, string> = {};
    
    data.headers.forEach((header, i) => {
      rowData[header] = row[i] || '';
    });
    
    setEditData(rowData);
    setEditingRow(rowIndex);
  };

  const handleSave = async () => {
    if (editingRow === null || !data) return;

    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke('google-sheets', {
        body: {
          action: 'update',
          row: editingRow + 2, // +2 because: +1 for header, +1 for 1-indexed
          data: editData,
        },
      });

      if (error) throw error;

      toast.success('資料已更新');
      setEditingRow(null);
      fetchData();
    } catch (error: any) {
      console.error('Error saving:', error);
      toast.error(error.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data || data.rows.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">沒有資料</p>
        <Button onClick={fetchData} variant="outline" className="mt-4">
          <RefreshCw className="h-4 w-4 mr-2" />
          重新載入
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          登入身份: <span className="font-medium text-foreground">{userEmail}</span>
        </p>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          重新整理
        </Button>
      </div>

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {data.headers.map((header, i) => (
                <TableHead key={i} className="whitespace-nowrap">
                  {header}
                </TableHead>
              ))}
              <TableHead className="w-20">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((row, rowIndex) => {
              const editable = canEditRow(row);
              return (
                <TableRow 
                  key={rowIndex}
                  className={editable ? 'bg-primary/5' : ''}
                >
                  {row.map((cell, cellIndex) => (
                    <TableCell key={cellIndex} className="whitespace-nowrap">
                      {cell}
                    </TableCell>
                  ))}
                  <TableCell>
                    {editable && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(rowIndex)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        * 高亮顯示的行是您可以編輯的資料（Email 與您的登入帳號相符）
      </p>

      <Dialog open={editingRow !== null} onOpenChange={() => setEditingRow(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>編輯資料</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {data.headers.map((header, i) => (
              <div key={i} className="space-y-2">
                <Label>{header}</Label>
                <Input
                  value={editData[header] || ''}
                  onChange={(e) =>
                    setEditData({ ...editData, [header]: e.target.value })
                  }
                  disabled={i === 0} // Email field is read-only
                />
                {i === 0 && (
                  <p className="text-xs text-muted-foreground">Email 欄位無法修改</p>
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRow(null)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              儲存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
