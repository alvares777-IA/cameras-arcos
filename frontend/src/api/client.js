import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || ''

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: { 'Content-Type': 'application/json' },
})

// ---- Cameras ----
export const getCameras = () => api.get('/api/cameras/')
export const getCamera = (id) => api.get(`/api/cameras/${id}`)
export const createCamera = (data) => api.post('/api/cameras/', data)
export const updateCamera = (id, data) => api.put(`/api/cameras/${id}`, data)
export const deleteCamera = (id) => api.delete(`/api/cameras/${id}`)

// ---- Gravações ----
export const getGravacoes = (params) => api.get('/api/gravacoes/', { params })
export const getGravacao = (id) => api.get(`/api/gravacoes/${id}`)
export const getGravacaoStreamUrl = (id) => `${API_BASE_URL}/api/gravacoes/${id}/stream`
export const deleteGravacoes = (params) => api.delete('/api/gravacoes/', { params })
export const deleteGravacao = (id) => api.delete(`/api/gravacoes/${id}`)
export const analyzeGravacao = (id) => api.post(`/api/gravacoes/${id}/analyze`)

// ---- Streams ----
export const getStreams = () => api.get('/api/stream/')
export const getStream = (cameraId) => api.get(`/api/stream/${cameraId}`)

// ---- Gravação (controle) ----
export const getRecordingStatus = () => api.get('/api/recording/status')
export const startRecording = () => api.post('/api/recording/start')
export const stopRecording = () => api.post('/api/recording/stop')

// ---- Reconhecimento Facial (controle) ----
export const getFaceRecognitionStatus = () => api.get('/api/face-recognition/status')
export const startFaceRecognition = () => api.post('/api/face-recognition/start')
export const stopFaceRecognition = () => api.post('/api/face-recognition/stop')

// ---- Health ----
export const getHealth = () => api.get('/api/health')

// ---- Pessoas ----
export const getPessoas = () => api.get('/api/pessoas/')
export const getPessoa = (id) => api.get(`/api/pessoas/${id}`)
export const createPessoa = (data) => api.post('/api/pessoas/', data)
export const updatePessoa = (id, data) => api.put(`/api/pessoas/${id}`, data)
export const deletePessoa = (id) => api.delete(`/api/pessoas/${id}`)

// ---- Faces ----
export const uploadFace = (idPessoa, file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post(`/api/pessoas/${idPessoa}/faces`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    })
}
export const getFaces = (idPessoa) => api.get(`/api/pessoas/${idPessoa}/faces`)
export const deleteFace = (idPessoa, filename) => api.delete(`/api/pessoas/${idPessoa}/faces/${filename}`)

// ---- Reconhecimentos ----
export const getReconhecimentos = (idPessoa) => api.get(`/api/pessoas/${idPessoa}/reconhecimentos`)
export const getReconhecimentosRecentes = () => api.get('/api/pessoas/reconhecimentos/recentes')

// ---- Grupos ----
export const getGrupos = () => api.get('/api/grupos/')
export const getGrupo = (id) => api.get(`/api/grupos/${id}`)
export const createGrupo = (data) => api.post('/api/grupos/', data)
export const updateGrupo = (id, data) => api.put(`/api/grupos/${id}`, data)
export const deleteGrupo = (id) => api.delete(`/api/grupos/${id}`)
export const addCameraToGrupo = (idGrupo, idCamera) => api.post(`/api/grupos/${idGrupo}/cameras/${idCamera}`)
export const removeCameraFromGrupo = (idGrupo, idCamera) => api.delete(`/api/grupos/${idGrupo}/cameras/${idCamera}`)

export default api
