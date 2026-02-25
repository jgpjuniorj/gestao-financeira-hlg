{{- define "gestao-financeira.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "gestao-financeira.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name (include "gestao-financeira.name" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "gestao-financeira.labels" -}}
app.kubernetes.io/name: {{ include "gestao-financeira.name" . }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | quote }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{- define "gestao-financeira.selectorLabels" -}}
app.kubernetes.io/name: {{ include "gestao-financeira.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "gestao-financeira.dbFullname" -}}
{{- if .Values.database.nameOverride -}}
{{- printf "%s-%s" (include "gestao-financeira.fullname" .) .Values.database.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-db" (include "gestao-financeira.fullname" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
