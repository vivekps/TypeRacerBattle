import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { type InsertRace } from '@shared/schema';

interface CreateRaceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRaceCreated?: (raceId: number) => void;
}

export function CreateRaceModal({ open, onOpenChange, onRaceCreated }: CreateRaceModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    maxPlayers: 4,
    difficulty: 'medium',
    timeLimit: 180,
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createRaceMutation = useMutation({
    mutationFn: async (data: InsertRace) => {
      const response = await apiRequest('POST', '/api/races', data);
      return response.json();
    },
    onSuccess: (race) => {
      queryClient.invalidateQueries({ queryKey: ['/api/races'] });
      toast({
        title: 'Race Created',
        description: `Race "${race.name}" has been created successfully.`,
      });
      onRaceCreated?.(race.id);
      onOpenChange(false);
      setFormData({ name: '', maxPlayers: 4, difficulty: 'medium', timeLimit: 180 });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create race. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createRaceMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-md mx-4">
        <DialogHeader>
          <DialogTitle>Create New Race</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Race Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter race name"
              required
            />
          </div>
          
          <div>
            <Label htmlFor="maxPlayers">Max Players</Label>
            <Select
              value={formData.maxPlayers.toString()}
              onValueChange={(value) => setFormData({ ...formData, maxPlayers: parseInt(value) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2 players</SelectItem>
                <SelectItem value="4">4 players</SelectItem>
                <SelectItem value="6">6 players</SelectItem>
                <SelectItem value="8">8 players</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="difficulty">Difficulty</Label>
            <Select
              value={formData.difficulty}
              onValueChange={(value) => setFormData({ ...formData, difficulty: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="timeLimit">Time Limit</Label>
            <Select
              value={formData.timeLimit.toString()}
              onValueChange={(value) => setFormData({ ...formData, timeLimit: parseInt(value) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="60">1 minute</SelectItem>
                <SelectItem value="120">2 minutes</SelectItem>
                <SelectItem value="180">3 minutes</SelectItem>
                <SelectItem value="300">5 minutes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex space-x-3 pt-4">
            <Button 
              type="submit" 
              className="flex-1"
              disabled={createRaceMutation.isPending}
            >
              {createRaceMutation.isPending ? 'Creating...' : 'Create Race'}
            </Button>
            <Button 
              type="button" 
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
