import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { useToast } from "@/hooks/use-toast";
import type { Client } from "@shared/schema";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Building2, Mail, Plus, Loader2, Search } from "lucide-react";

export default function ClientsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [primaryContactName, setPrimaryContactName] = useState("");
  const [primaryContactEmail, setPrimaryContactEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  interface ClientAnalytics {
    clientId: number;
    clientName: string;
    rolesCount: number;
    totalApplications: number;
    placementsCount: number;
  }

  // Protect route (should also be wrapped in ProtectedRoute)
  if (user && !["admin", "recruiter"].includes(user.role)) {
    return <Redirect to="/jobs" />;
  }

  const {
    data: clients = [],
    isLoading,
  } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const res = await fetch("/api/clients", {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to fetch clients");
      }
      return res.json();
    },
    enabled: !!user && ["admin", "recruiter"].includes(user.role),
  });

  const { data: clientMetrics = [] } = useQuery<ClientAnalytics[]>({
    queryKey: ["/api/analytics/clients"],
    queryFn: async () => {
      const res = await fetch("/api/analytics/clients", {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to fetch client analytics");
      }
      return res.json();
    },
    enabled: !!user && ["admin", "recruiter"].includes(user.role),
  });

  const metricsByClientId = new Map<number, ClientAnalytics>();
  clientMetrics.forEach((m) => metricsByClientId.set(m.clientId, m));

  const resetForm = () => {
    setEditingClient(null);
    setName("");
    setDomain("");
    setPrimaryContactName("");
    setPrimaryContactEmail("");
    setNotes("");
  };

  const openCreateDialog = () => {
    resetForm();
    setShowDialog(true);
  };

  const openEditDialog = (client: Client) => {
    setEditingClient(client);
    setName(client.name);
    setDomain(client.domain ?? "");
    setPrimaryContactName(client.primaryContactName ?? "");
    setPrimaryContactEmail(client.primaryContactEmail ?? "");
    setNotes(client.notes ?? "");
    setShowDialog(true);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        domain: domain || undefined,
        primaryContactName: primaryContactName || undefined,
        primaryContactEmail: primaryContactEmail || undefined,
        notes: notes || undefined,
      };
      const res = await apiRequest("POST", "/api/clients", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Client Created",
        description: "Client has been added successfully.",
      });
      setShowDialog(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Create Client",
        description: error.message || "An error occurred while creating the client.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingClient) return;
      const payload = {
        ...(name && { name }),
        domain: domain || null,
        primaryContactName: primaryContactName || null,
        primaryContactEmail: primaryContactEmail || null,
        notes: notes || null,
      };
      const res = await apiRequest("PATCH", `/api/clients/${editingClient.id}`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Client Updated",
        description: "Client details have been updated successfully.",
      });
      setShowDialog(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Update Client",
        description: error.message || "An error occurred while updating the client.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!name.trim()) {
      toast({
        title: "Missing name",
        description: "Client name is required.",
        variant: "destructive",
      });
      return;
    }
    if (editingClient) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  const filteredClients = clients.filter((client) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const haystack = `${client.name} ${client.domain ?? ""} ${client.primaryContactName ?? ""} ${
      client.primaryContactEmail ?? ""
    }`.toLowerCase();
    return haystack.includes(q);
  });

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pt-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 flex items-center gap-2">
              <Building2 className="w-7 h-7 text-primary" />
              Clients
            </h1>
            <p className="text-slate-500 text-sm md:text-base">
              Manage client organizations for agency and multi-company recruiting.
            </p>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Add Client
          </Button>
        </div>

        {/* Search / Filters */}
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                <Input
                  placeholder="Search by name, domain, or contact..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Clients Table */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-slate-900">Client List</CardTitle>
            <CardDescription className="text-slate-500">
              All clients you manage for job postings and analytics.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-600 mb-2">No clients yet</p>
                <p className="text-slate-500 text-sm">
                  Add clients to organize roles by company and simplify reporting.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-200 hover:bg-slate-50">
                    <TableHead className="text-slate-600">Name</TableHead>
                    <TableHead className="text-slate-600">Domain</TableHead>
                    <TableHead className="text-slate-600">Primary Contact</TableHead>
                    <TableHead className="text-slate-600">Email</TableHead>
                    <TableHead className="text-slate-600 hidden md:table-cell">
                      Notes
                    </TableHead>
                    <TableHead className="text-slate-600 text-right">
                      Roles
                    </TableHead>
                    <TableHead className="text-slate-600 text-right">
                      Applications
                    </TableHead>
                    <TableHead className="text-slate-600 text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients.map((client) => (
                    <TableRow key={client.id} className="border-slate-200 hover:bg-slate-50">
                      <TableCell className="text-slate-900 font-medium">
                        {client.name}
                      </TableCell>
                      <TableCell className="text-slate-600 text-sm">
                        {client.domain ? (
                          <a
                            href={
                              client.domain.startsWith("http")
                                ? client.domain
                                : `https://${client.domain}`
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline"
                          >
                            {client.domain}
                          </a>
                        ) : (
                          <span className="text-slate-400 text-xs">Not set</span>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-600 text-sm">
                        {client.primaryContactName ? (
                          client.primaryContactName
                        ) : (
                          <span className="text-slate-400 text-xs">Not set</span>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-600 text-sm">
                        {client.primaryContactEmail ? (
                          <span className="inline-flex items-center gap-1">
                            <Mail className="w-3 h-3 text-slate-400" />
                            {client.primaryContactEmail}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">Not set</span>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-600 text-xs hidden md:table-cell max-w-xs">
                        {client.notes ? (
                          <span className="line-clamp-2">{client.notes}</span>
                        ) : (
                          <span className="text-slate-400">–</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm text-slate-600">
                        {metricsByClientId.get(client.id)?.rolesCount ?? 0}
                      </TableCell>
                      <TableCell className="text-right text-sm text-slate-600">
                        {metricsByClientId.get(client.id)?.totalApplications ?? 0}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(client)}
                        >
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Create / Edit Dialog */}
        <Dialog
          open={showDialog}
          onOpenChange={(open) => {
            setShowDialog(open);
            if (!open) resetForm();
          }}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingClient ? "Edit Client" : "Add Client"}
              </DialogTitle>
              <DialogDescription>
                {editingClient
                  ? "Update client details for better organization and reporting."
                  : "Create a new client that you can associate jobs with."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label htmlFor="client-name">Name *</Label>
                <Input
                  id="client-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1"
                  placeholder="Acme Corp"
                />
              </div>
              <div>
                <Label htmlFor="client-domain">Domain</Label>
                <Input
                  id="client-domain"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  className="mt-1"
                  placeholder="acme.com"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="client-contact-name">Primary Contact Name</Label>
                  <Input
                    id="client-contact-name"
                    value={primaryContactName}
                    onChange={(e) => setPrimaryContactName(e.target.value)}
                    className="mt-1"
                    placeholder="Jane Doe"
                  />
                </div>
                <div>
                  <Label htmlFor="client-contact-email">Primary Contact Email</Label>
                  <Input
                    id="client-contact-email"
                    type="email"
                    value={primaryContactEmail}
                    onChange={(e) => setPrimaryContactEmail(e.target.value)}
                    className="mt-1"
                    placeholder="jane.doe@acme.com"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="client-notes">Notes</Label>
                <Textarea
                  id="client-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1"
                  rows={3}
                  placeholder="Key stakeholders, expectations, or special terms..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDialog(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Save
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
