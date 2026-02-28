import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || ''

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: { 'Content-Type': 'application/json' },
    withCredentials: true,  // Envia cookies em todas as requisições
})

// Interceptor: redireciona para login se 401
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 && !window.location.pathname.includes('/login')) {
            window.location.href = '/login'
        }
        return Promise.reject(error)
    }
)

// ---- Auth ----
export const apiLogin = (login, senha) => api.post('/api/auth/login', { login, senha })
export const apiLogout = () => api.post('/api/auth/logout')
export const apiGetMe = () => api.get('/api/auth/me')

// ---- Cameras ----
export const getCameras = () => api.get('/api/cameras/')
export const getCamera = (id) => api.get(`/api/cameras/${id}`)
export const createCamera = (data) => api.post('/api/cameras/', data)
export const updateCamera = (id, data) => api.put(`/api/cameras/${id}`, data)
export const deleteCamera = (id) => api.delete(`/api/cameras/${id}`)
export const toggleCameraContinuos = (id) => api.patch(`/api/cameras/${id}/continuos`)
export const probeCamera = (id) => api.post(`/api/cameras/${id}/probe`)

// ---- Gravações ----
export const getGravacoes = (params) => api.get('/api/gravacoes/', { params })
export const getGravacao = (id) => api.get(`/api/gravacoes/${id}`)
export const getGravacaoStreamUrl = (id) => `${API_BASE_URL}/api/gravacoes/${id}/stream`
export const getGravacaoDownloadUrl = (id) => `${API_BASE_URL}/api/gravacoes/${id}/download`
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
export const getContinuousRecordingStatus = () => api.get('/api/recording/continuous/status')
export const startContinuousRecording = () => api.post('/api/recording/continuous/start')
export const stopContinuousRecording = () => api.post('/api/recording/continuous/stop')
export const disableContinuousRecording = () => api.post('/api/recording/continuous/disable')


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
export const getPessoaFaceUrl = (id) => `${API_BASE_URL}/api/pessoas/${id}/face-image`

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

// ---- Parâmetros ----
export const getParametros = () => api.get('/api/parametros/')
export const syncParametros = () => api.post('/api/parametros/sync')
export const createParametro = (data) => api.post('/api/parametros/', data)
export const updateParametro = (id, data) => api.put(`/api/parametros/${id}`, data)
export const deleteParametro = (id) => api.delete(`/api/parametros/${id}`)

// ---- Usuários ----
export const getUsuarios = () => api.get('/api/usuarios/')
export const createUsuario = (data) => api.post('/api/usuarios/', data)
export const updateUsuario = (id, data) => api.put(`/api/usuarios/${id}`, data)
export const deleteUsuario = (id) => api.delete(`/api/usuarios/${id}`)
export const updateUsuarioMenus = (id, menu_ids) => api.put(`/api/usuarios/${id}/menus`, { menu_ids })
export const updateUsuarioCameras = (id, camera_ids) => api.put(`/api/usuarios/${id}/cameras`, { camera_ids })
export const getAllMenus = () => api.get('/api/usuarios/menus/all')
export const getAllCameras = () => api.get('/api/cameras/all')

export default api
