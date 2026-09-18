import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  Zap,
  Eye,
  Bell,
  Clock,
  Filter,
  Loader2,
  Search,
  User,
  Car,
  Box,
} from 'lucide-react';
import { camerasApi, CameraEvent, PluginType } from '../api/cameras.api';

export interface EventTimelineProps {
  cameraId: string;
  pluginType: PluginType;
}

export const EventTimeline: React.FC<EventTimelineProps> = ({
  cameraId,
}) => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<'ALL' | 'STATUS' | 'MOTION' | 'DETECTION'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => setPage(0), [filter, searchQuery, cameraId]);

  // Fetch persisted events
  const {
    data: events = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['camera-events', cameraId, filter, searchQuery],
    queryFn: () =>
      camerasApi.getEvents(
        cameraId,
        50,
        filter === 'ALL' ? undefined : filter,
        searchQuery ? searchQuery.trim() : undefined,
      ),
    enabled: !!cameraId,
  });

  const simulateMutation = useMutation({
    mutationFn: () =>
      camerasApi.triggerEvent(cameraId, 'MOTION', {
        zone: 'front_porch',
        confidence: 0.96,
        description: 'Simulated motion detected in monitored zone',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['camera-events', cameraId] });
      refetch();
    },
  });

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'MOTION':
        return <Zap className="w-4 h-4 text-[#87622B]" />;
      case 'DETECTION':
        return <Eye className="w-4 h-4 text-violet-400" />;
      case 'STATUS':
      default:
        return <Activity className="w-4 h-4 text-sky-400" />;
    }
  };

  const getEventBadgeClass = (type: string) => {
    switch (type) {
      case 'MOTION':
        return 'bg-amber-500/10 text-[#87622B] border-amber-500/20';
      case 'DETECTION':
        return 'bg-violet-500/10 text-violet-400 border-violet-500/20';
      case 'STATUS':
      default:
        return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
    }
  };

  const formatEventMessage = (event: CameraEvent) => {
    if (event.payload?.eventType === 'PERSON_EXITED') return 'Selected zone cleared';
    if (event.payload?.eventType === 'PERSON_ENTERED') return 'Person entered the selected zone';
    if (event.payload?.eventType === 'PERSON_PRESENT') return 'Person remains in the selected zone';
    if (event.type === 'DETECTION') {
      const primary = event.payload?.primaryDetection || event.payload?.detections?.[0];
      if (primary) {
        return `Detected ${primary.label} (${((primary.confidence || 0.9) * 100).toFixed(0)}% confidence)`;
      }
      return 'No objects detected in the analyzed frame';
    }
    if (event.payload?.message) return String(event.payload.message);
    if (event.payload?.status) return `Camera status changed to ${event.payload.status}`;
    if (event.payload?.zone) return 'Movement detected in the selected zone';
    return `${event.type} event logged`;
  };

  const formatTimestamp = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div
      data-testid="event-timeline"
      className="bg-[#FFFFFF] border border-[#DCE3D9] rounded-2xl p-6 space-y-4 shadow-sm "
    >
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-[#DCE3D9]">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-[#EDF1EA] text-[#253D2C] rounded-lg">
            <Bell className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#253D2C]">Activity Timeline</h3>
            <p className="text-xs text-[#617166]">
              Audit log of camera status transitions, motion, and detections
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#617166] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1 bg-[#F8F4EB] border border-[#DCE3D9] rounded-xl text-xs text-[#253D2C] placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-36 sm:w-44"
            />
          </div>

          {/* Filter Chips */}
          <div className="flex items-center bg-[#F8F4EB] p-1 rounded-xl border border-[#DCE3D9] text-xs">
            <button
              onClick={() => setFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                filter === 'ALL'
                  ? 'bg-indigo-600 text-[#253D2C] shadow-sm'
                  : 'text-[#617166] hover:text-[#253D2C]'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('STATUS')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                filter === 'STATUS'
                  ? 'bg-indigo-600 text-[#253D2C] shadow-sm'
                  : 'text-[#617166] hover:text-[#253D2C]'
              }`}
            >
              Status
            </button>
            <button
              onClick={() => setFilter('MOTION')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                filter === 'MOTION'
                  ? 'bg-indigo-600 text-[#253D2C] shadow-sm'
                  : 'text-[#617166] hover:text-[#253D2C]'
              }`}
            >
              Motion
            </button>
            <button
              onClick={() => setFilter('DETECTION')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                filter === 'DETECTION'
                  ? 'bg-indigo-600 text-[#253D2C] shadow-sm'
                  : 'text-[#617166] hover:text-[#253D2C]'
              }`}
            >
              Detection
            </button>
          </div>



          {/* Simulate Motion Button */}
          <button
            onClick={() => simulateMutation.mutate()}
            disabled={simulateMutation.isPending}
            className="flex items-center gap-1.5 text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-[#87622B] py-1.5 px-3 rounded-xl border border-amber-500/20 transition-colors disabled:opacity-50"
            title="Trigger simulated motion event for testing and demonstrations"
          >
            {simulateMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Zap className="w-3.5 h-3.5" />
            )}
            Simulate Motion
          </button>
        </div>
      </div>

      {/* Events Stream */}
      {isLoading ? (
        <div className="p-8 text-center text-[#617166]">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
          <p className="text-xs">Loading event logs...</p>
        </div>
      ) : events.length === 0 ? (
        <div className="p-8 text-center bg-[#F8F4EB] rounded-xl border border-dashed border-[#DCE3D9]">
          <Filter className="w-6 h-6 text-[#617166] mx-auto mb-2 opacity-50" />
          <p className="text-xs font-medium text-[#617166]">No events recorded</p>
          <p className="text-[11px] text-[#617166] mt-0.5">
            Start Person detection above to monitor your selected zone.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5 pr-1">
          {events.slice(page * 5, page * 5 + 5).map((ev) => {
            const primary =
              ev.type === 'DETECTION'
                ? ev.payload?.primaryDetection || ev.payload?.detections?.[0]
                : null;

            return (
              <div
                key={ev.id}
                className="p-3 bg-[#F8F4EB] border border-[#DCE3D9] rounded-xl flex items-center justify-between gap-3 text-xs hover:border-[#DCE3D9] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[#FFFFFF] border border-[#DCE3D9]">
                    {getEventIcon(ev.type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full border ${getEventBadgeClass(
                          ev.type,
                        )}`}
                      >
                        {ev.type}
                      </span>
                      <span className="text-[#253D2C] font-medium">
                        {formatEventMessage(ev)}
                      </span>
                    </div>

                    {/* Rich AI Detection metadata */}
                    {primary && (
                      <div className="flex items-center gap-2 mt-1 text-[11px] font-sans text-[#617166]">
                        <span className="flex items-center gap-1 text-violet-300">
                          {primary.label === 'person' ? (
                            <User className="w-3 h-3" />
                          ) : primary.label === 'vehicle' ? (
                            <Car className="w-3 h-3" />
                          ) : (
                            <Box className="w-3 h-3" />
                          )}
                          {primary.label}
                        </span>
                        <span>•</span>
                        <span>{((primary.confidence || 0.9) * 100).toFixed(0)}% confidence</span>
                        {primary.box && (
                          <>
                            <span>•</span>
                            <span className="text-[#617166] text-[10px]">
                              box [{primary.box.x}, {primary.box.y}, {primary.box.width}x{primary.box.height}]
                            </span>
                          </>
                        )}
                      </div>
                    )}

                    {!primary && ev.payload?.confidence && (
                      <span className="text-[10px] text-[#617166] font-sans mt-0.5 inline-block">
                        confidence: {(ev.payload.confidence * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-[#617166] font-sans shrink-0">
                  <Clock className="w-3 h-3" />
                  <span>{formatTimestamp(ev.createdAt)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {events.length > 5 && <nav className="list-pagination" aria-label="Activity pages"><button disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</button><span>{page + 1} / {Math.ceil(events.length / 5)}</span><button disabled={(page + 1) * 5 >= events.length} onClick={() => setPage(p => p + 1)}>Next</button></nav>}

    </div>
  );
};
